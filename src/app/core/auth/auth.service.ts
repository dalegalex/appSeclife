import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import {
  AccessControl,
  BiometricAuthError,
  BiometryType,
  NativeBiometric,
} from '@capgo/capacitor-native-biometric';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Observable, catchError, finalize, firstValueFrom, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AccountDeletionRequest,
  AccountDeletionResponse,
  AuthSession,
  AuthUser,
  GoogleLoginRequest,
  LocalAuthStartResponse,
  LocalAuthVerifyRequest,
  LocalLoginStartRequest,
  LocalRegisterStartRequest,
  RegistrationCodePreview,
  RegisterWithCodeRequest,
  AuthOrganizationBrand,
  AuthMenuItem,
  BiometricCapability,
  BiometricCredentialEnrollRequest,
  BiometricCredentialEnrollResponse,
  BiometricLoginRequest,
  EndSupportSessionResponse,
  SupportSessionContext,
} from './auth.models';

const SESSION_KEY = 'seclife.mobile.auth.session';
const BIOMETRIC_SERVER = 'mx.com.seclife.schoolmaster.auth';
const BIOMETRIC_META_KEY = 'seclife.mobile.auth.biometric.meta';
const ANDROID_BIOMETRIC_AUTH_VALIDITY_SECONDS = 10;

interface BiometricMetadata {
  deviceUid: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = Capacitor.isNativePlatform()
    ? environment.androidApiUrl
    : environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/auth`;
  private readonly sessionSignal = signal<AuthSession | null>(this.readStoredSession());
  private readonly appMenuSignal = signal<AuthMenuItem[]>([]);
  private readonly appMenuLoadedSignal = signal(false);
  private readonly appMenuLoadingSignal = signal(false);
  private readonly appMenuErrorSignal = signal<string | null>(null);
  private appMenuRequest$: Observable<AuthMenuItem[]> | null = null;
  private supportActorSession: AuthSession | null = null;

  readonly session = computed(() => this.sessionSignal());
  readonly supportContext = computed<SupportSessionContext | null>(() => this.sessionSignal()?.support ?? null);
  readonly isSupportSession = computed(() => !!this.supportContext());
  readonly user = computed(() => this.sessionSignal()?.user ?? null);
  readonly appMenuItems = computed(() => this.flattenMenu(this.appMenuSignal()));
  readonly appMenuLoaded = computed(() => this.appMenuLoadedSignal());
  readonly appMenuLoading = computed(() => this.appMenuLoadingSignal());
  readonly appMenuError = computed(() => this.appMenuErrorSignal());
  readonly isAuthenticated = computed(() => {
    const session = this.sessionSignal();
    return !!session?.token && !this.isExpired(session.expiresAt);
  });

  constructor(private readonly http: HttpClient) {}

  loginWithGoogle(idToken: string): Observable<AuthSession> {
    const request: GoogleLoginRequest = { idToken };

    return this.http.post<AuthSession>(`${this.baseUrl}/google`, request).pipe(
      tap((session) => this.setSession(session))
    );
  }

  previewRegistrationCode(codereg: string): Observable<RegistrationCodePreview> {
    return this.http.get<RegistrationCodePreview>(
      `${this.baseUrl}/registro-codigo/${encodeURIComponent(codereg)}`
    );
  }

  registerWithCode(request: RegisterWithCodeRequest): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.baseUrl}/registro-codigo`, request).pipe(
      tap((session) => this.setSession(session))
    );
  }

  startLocalLogin(email: string): Observable<LocalAuthStartResponse> {
    const request: LocalLoginStartRequest = { email };
    return this.http.post<LocalAuthStartResponse>(`${this.baseUrl}/local/login`, request);
  }

  startLocalRegister(request: LocalRegisterStartRequest): Observable<LocalAuthStartResponse> {
    return this.http.post<LocalAuthStartResponse>(`${this.baseUrl}/local/registro-codigo`, request);
  }

  verifyLocalAuth(email: string, codigo: string): Observable<AuthSession> {
    const request: LocalAuthVerifyRequest = { email, codigo };
    return this.http.post<AuthSession>(`${this.baseUrl}/local/verificar`, request).pipe(
      tap((session) => this.setSession(session))
    );
  }

  requestAccountDeletion(request: AccountDeletionRequest): Observable<AccountDeletionResponse> {
    return this.http.post<AccountDeletionResponse>(`${this.baseUrl}/cuenta/eliminacion-solicitudes`, request);
  }

  activateSupportSession(codigo: string): Observable<AuthSession> {
    const actorSession = this.sessionSignal();
    if (!actorSession || this.isSupportSession()) {
      throw new Error('Inicia sesion con la cuenta administrativa antes de activar el modo soporte.');
    }

    return this.http.post<AuthSession>(`${this.apiUrl}/acceso-soporte/sesiones`, { codigo: codigo.trim() }).pipe(
      tap(session => {
        this.supportActorSession = actorSession;
        this.setSession(session);
      })
    );
  }

  endSupportSession(): Observable<EndSupportSessionResponse> {
    if (!this.isSupportSession()) {
      throw new Error('No existe una sesion de soporte activa.');
    }

    return this.http.post<EndSupportSessionResponse>(
      `${this.apiUrl}/acceso-soporte/sesiones/actual/finalizar`,
      {}
    ).pipe(finalize(() => this.restoreActorSession()));
  }

  getToken(): string | null {
    const session = this.sessionSignal();
    return session && !this.isExpired(session.expiresAt) ? session.token : null;
  }

  getOrganizationBrand(): Observable<AuthOrganizationBrand> {
    return this.http.get<AuthOrganizationBrand>(`${this.baseUrl}/organizacion/identidad`);
  }

  loadAppMenu(force = false): Observable<AuthMenuItem[]> {
    if (!this.isAuthenticated()) {
      this.resetAppMenu();
      return of([]);
    }

    if (this.appMenuRequest$) {
      return this.appMenuRequest$;
    }

    if (!force && this.appMenuLoadedSignal()) {
      return of(this.appMenuSignal());
    }

    this.appMenuLoadingSignal.set(true);
    this.appMenuErrorSignal.set(null);

    const request$ = this.http.get<AuthMenuItem[]>(`${this.baseUrl}/menu`, {
      params: { canal: 'APP' },
    }).pipe(
      tap(items => {
        this.appMenuSignal.set(items ?? []);
        this.appMenuLoadedSignal.set(true);
      }),
      catchError(() => {
        this.appMenuSignal.set([]);
        this.appMenuLoadedSignal.set(false);
        this.appMenuErrorSignal.set('No fue posible cargar los permisos del menu.');
        return of([]);
      }),
      finalize(() => {
        this.appMenuLoadingSignal.set(false);
        this.appMenuRequest$ = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.appMenuRequest$ = request$;
    return request$;
  }

  canAccessAppRoute(route: string): boolean {
    if (!this.appMenuLoadedSignal()) {
      return false;
    }

    const target = this.normalizeRoute(route);
    return this.appMenuItems().some(item =>
      item.puedever && !!item.ruta && this.normalizeRoute(item.ruta) === target
    );
  }

  async getBiometricCapability(): Promise<BiometricCapability> {
    if (!Capacitor.isNativePlatform()) {
      return {
        available: false,
        configured: false,
        deviceCredentialAvailable: false,
        label: 'Biometria',
        reason: 'Disponible solamente en la aplicacion movil.',
      };
    }

    try {
      const availability = await NativeBiometric.isAvailable({ useFallback: true });
      const stored = await NativeBiometric.isCredentialsSaved({ server: BIOMETRIC_SERVER });
      const available = availability.isAvailable && availability.strongBiometryIsAvailable;

      return {
        available,
        configured: available && stored.isSaved && !!this.readBiometricMetadata(),
        deviceCredentialAvailable: availability.deviceIsSecure === true,
        label: this.biometryLabel(availability.biometryType),
        reason: available
          ? null
          : this.biometryUnavailableReason(availability.errorCode),
      };
    } catch {
      return {
        available: false,
        configured: false,
        deviceCredentialAvailable: false,
        label: 'Biometria',
        reason: 'No fue posible consultar la seguridad biometrica del dispositivo.',
      };
    }
  }

  async enableBiometricAccess(): Promise<BiometricCapability> {
    const user = this.getCurrentUser();
    if (!user || !this.isAuthenticated()) {
      throw new Error('Inicia sesion antes de activar el acceso biometrico.');
    }

    const capability = await this.getBiometricCapability();
    if (!capability.available) {
      throw new Error(capability.reason ?? 'El dispositivo no tiene biometria segura disponible.');
    }

    const deviceUid = crypto.randomUUID();
    const [deviceInfo, appInfo] = await Promise.all([Device.getInfo(), App.getInfo()]);
    const request: BiometricCredentialEnrollRequest = {
      deviceUid,
      platform: Capacitor.getPlatform() === 'ios' ? 'IOS' : 'ANDROID',
      deviceModel: [deviceInfo.manufacturer, deviceInfo.model].filter(Boolean).join(' ').trim() || null,
      operatingSystem: [deviceInfo.operatingSystem, deviceInfo.osVersion].filter(Boolean).join(' ').trim() || null,
      appVersion: [appInfo.version, appInfo.build].filter(Boolean).join('.'),
    };

    const enrolled = await firstValueFrom(
      this.http.post<BiometricCredentialEnrollResponse>(
        `${this.baseUrl}/biometria/credenciales`,
        request
      )
    );

    try {
      await this.storeBiometricCredential(enrolled, request);
      this.writeBiometricMetadata({
        deviceUid: enrolled.deviceUid,
      });
    } catch (error) {
      await this.revokeRemoteBiometricCredential(enrolled.deviceUid, 'ALMACENAMIENTO_LOCAL_FALLIDO');
      throw error;
    }

    return this.getBiometricCapability();
  }

  async loginWithBiometric(): Promise<AuthSession> {
    try {
      const credentials = await NativeBiometric.getSecureCredentials({
        server: BIOMETRIC_SERVER,
        reason: 'Confirma tu identidad para ingresar a Seclife.',
        title: 'Ingresar a Seclife',
        subtitle: 'Acceso protegido en este dispositivo',
        negativeButtonText: 'Usar otro metodo',
      });
      const request: BiometricLoginRequest = {
        deviceUid: credentials.username,
        credential: credentials.password,
      };
      const session = await firstValueFrom(
        this.http.post<AuthSession>(`${this.baseUrl}/biometria/ingresar`, request).pipe(
          tap(value => this.setSession(value))
        )
      );
      this.writeBiometricMetadata({
        deviceUid: credentials.username,
      });
      return session;
    } catch (error) {
      if (this.isRejectedBiometricCredential(error)) {
        await this.clearLocalBiometricCredential();
      }
      throw error;
    }
  }

  async verifyBiometricIdentity(): Promise<void> {
    const capability = await this.getBiometricCapability();
    if (!capability.configured) {
      throw new Error(
        capability.reason
        ?? 'El acceso biometrico no esta configurado en este dispositivo.'
      );
    }

    const credentials = await NativeBiometric.getSecureCredentials({
      server: BIOMETRIC_SERVER,
      reason: 'Confirma tu identidad para continuar en Seclife.',
      title: 'Desbloquear Seclife',
      subtitle: 'Sesion protegida',
      negativeButtonText: 'Usar otro metodo',
    });

    if (!credentials.username || !credentials.password) {
      throw new Error('No fue posible validar la credencial protegida del dispositivo.');
    }
  }

  async verifyDeviceCredentialIdentity(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('La seguridad del dispositivo solo esta disponible en la aplicacion movil.');
    }

    const capability = await this.getBiometricCapability();
    if (!capability.deviceCredentialAvailable) {
      throw new Error('Configura un PIN, patron o contrasena segura en el dispositivo.');
    }

    const commonOptions = {
      reason: 'Confirma la seguridad del dispositivo para continuar en Seclife.',
      title: 'Desbloquear Seclife',
      subtitle: 'Usa el PIN, patron o contrasena del dispositivo',
    };

    if (Capacitor.getPlatform() === 'android') {
      await NativeBiometric.verifyIdentity({
        ...commonOptions,
        allowedBiometryTypes: [BiometryType.DEVICE_CREDENTIAL],
      });
      return;
    }

    await NativeBiometric.verifyIdentity({
      ...commonOptions,
      useFallback: true,
    });
  }

  async disableBiometricAccess(reason = 'USUARIO_REVOCA'): Promise<void> {
    const metadata = this.readBiometricMetadata();
    if (metadata?.deviceUid && this.isAuthenticated()) {
      await this.revokeRemoteBiometricCredential(metadata.deviceUid, reason);
    }
    await this.clearLocalBiometricCredential();
  }

  canExecuteAppRoute(route: string): boolean {
    if (!this.appMenuLoadedSignal()) {
      return false;
    }

    const target = this.normalizeRoute(route);
    return this.appMenuItems().some(item =>
      item.puedever && item.puedeejecutar && !!item.ruta && this.normalizeRoute(item.ruta) === target
    );
  }


  getCurrentUserId(): number | null {
    return this.sessionSignal()?.user?.idusrbt ?? null;
  }

  getCurrentProfileId(): number | null {
    const idperfil = this.sessionSignal()?.user?.idperfil;
    const numericProfile = Number(idperfil);
    return Number.isFinite(numericProfile) && numericProfile > 0 ? numericProfile : null;
  }

  getCurrentFamilyId(): number | null {
    return this.sessionSignal()?.user?.idfamilia ?? null;
  }

  getCurrentUser(): AuthUser | null {
    return this.sessionSignal()?.user ?? null;
  }

  hasFamilyAccess(): boolean {
    const user = this.getCurrentUser();
    return !!user?.idfamilia || Number(user?.idperfil) === 4;
  }

  getDisplayName(): string {
    const user = this.getCurrentUser();
    const fullName = [user?.nombre, user?.apellidos].filter(Boolean).join(' ').trim();
    return user?.googleName || user?.usr || fullName || 'Usuario Seclife';
  }

  getInitials(): string {
    const parts = this.getDisplayName()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    return (parts.map((part) => part[0]).join('') || 'S').toUpperCase();
  }

  signOut(): void {
    const email = this.supportActorSession?.user?.email ?? this.getCurrentUser()?.email ?? null;
    this.supportActorSession = null;
    const metadata = this.readBiometricMetadata();
    if (metadata?.deviceUid) {
      void this.revokeRemoteBiometricCredential(metadata.deviceUid, 'CIERRE_SESION')
        .catch(() => undefined);
      void this.clearLocalBiometricCredential();
    }
    localStorage.removeItem(SESSION_KEY);
    this.resetAppMenu();
    this.sessionSignal.set(null);
    this.closeNativeGoogleSession();
    this.closeGoogleSession(email);
  }

  private setSession(session: AuthSession): void {
    this.resetAppMenu();
    localStorage.removeItem(SESSION_KEY);
    this.sessionSignal.set(session);
  }

  private restoreActorSession(): void {
    const actorSession = this.supportActorSession;
    this.supportActorSession = null;
    if (actorSession && !this.isExpired(actorSession.expiresAt)) {
      this.setSession(actorSession);
      this.loadAppMenu(true).subscribe();
      return;
    }
    this.clearSessionPreservingBiometricAccess();
  }

  private resetAppMenu(): void {
    this.appMenuSignal.set([]);
    this.appMenuLoadedSignal.set(false);
    this.appMenuLoadingSignal.set(false);
    this.appMenuErrorSignal.set(null);
    this.appMenuRequest$ = null;
  }

  private flattenMenu(items: AuthMenuItem[]): AuthMenuItem[] {
    return items.flatMap(item => [item, ...this.flattenMenu(item.children ?? [])]);
  }

  private normalizeRoute(route: string): string {
    const cleanRoute = (route ?? '').split(/[?#]/, 1)[0].trim();

    if (!cleanRoute) {
      return '/';
    }

    return cleanRoute.length > 1 ? cleanRoute.replace(/\/+$/, '') : cleanRoute;
  }


  private readStoredSession(): AuthSession | null {
    const raw = localStorage.getItem(SESSION_KEY);

    if (!raw) {
      return null;
    }

    try {
      const session = JSON.parse(raw) as AuthSession;
      localStorage.removeItem(SESSION_KEY);
      return this.isExpired(session.expiresAt) ? null : session;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  clearSessionPreservingBiometricAccess(): void {
    localStorage.removeItem(SESSION_KEY);
    this.resetAppMenu();
    this.sessionSignal.set(null);
  }

  private async revokeRemoteBiometricCredential(deviceUid: string, reason: string): Promise<void> {
    if (!this.isAuthenticated()) {
      return;
    }

    await firstValueFrom(
      this.http.post<void>(`${this.baseUrl}/biometria/revocar`, { deviceUid, reason })
    );
  }

  private async clearLocalBiometricCredential(): Promise<void> {
    localStorage.removeItem(BIOMETRIC_META_KEY);
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER }).catch(() => undefined);
  }

  private async storeBiometricCredential(
    enrolled: BiometricCredentialEnrollResponse,
    request: BiometricCredentialEnrollRequest
  ): Promise<void> {
    const commonOptions = {
      server: BIOMETRIC_SERVER,
      username: enrolled.deviceUid,
      password: enrolled.credential,
      accessControl: AccessControl.BIOMETRY_CURRENT_SET,
      title: 'Activar acceso biometrico',
      negativeButtonText: 'Cancelar',
    };

    try {
      await NativeBiometric.setCredentials({
        ...commonOptions,
        // Algunos KeyStore Samsung necesitan una ventana breve para completar
        // el cifrado AES/GCM despues de que la huella fue validada.
        authValidityDuration: Capacitor.getPlatform() === 'android'
          ? ANDROID_BIOMETRIC_AUTH_VALIDITY_SECONDS
          : 1,
      });
    } catch (primaryError) {
      if (
        this.isBiometricCancellation(primaryError)
        || Capacitor.getPlatform() !== 'android'
      ) {
        throw primaryError;
      }

      console.warn('[Biometria] Reintento de almacenamiento seguro por operacion.', {
        deviceModel: request.deviceModel,
        operatingSystem: request.operatingSystem,
        primaryError: this.biometricErrorDetails(primaryError),
      });

      await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER }).catch(() => undefined);

      try {
        await NativeBiometric.setCredentials({
          ...commonOptions,
          authValidityDuration: 0,
        });
      } catch (fallbackError) {
        console.error('[Biometria] El dispositivo rechazo ambas estrategias de cifrado.', {
          deviceModel: request.deviceModel,
          operatingSystem: request.operatingSystem,
          primaryError: this.biometricErrorDetails(primaryError),
          fallbackError: this.biometricErrorDetails(fallbackError),
        });
        if (this.isBiometricCancellation(fallbackError)) {
          throw fallbackError;
        }
        throw new Error(
          'Este dispositivo no es compatible con el almacenamiento biometrico seguro de Seclife. Puedes continuar ingresando con Google o correo personal.'
        );
      }
    }
  }

  private isBiometricCancellation(error: unknown): boolean {
    const code = Number((error as { code?: number | string })?.code);
    return code === BiometricAuthError.USER_CANCEL
      || code === BiometricAuthError.USER_FALLBACK
      || code === BiometricAuthError.APP_CANCEL
      || code === BiometricAuthError.SYSTEM_CANCEL;
  }

  private biometricErrorDetails(error: unknown): { code: number | string | null; message: string } {
    const value = error as { code?: number | string; message?: string } | null;
    return {
      code: value?.code ?? null,
      message: value?.message?.trim() || 'Error biometrico sin detalle del proveedor.',
    };
  }
  private readBiometricMetadata(): BiometricMetadata | null {
    const raw = localStorage.getItem(BIOMETRIC_META_KEY);
    if (!raw) {
      return null;
    }

    try {
      const value = JSON.parse(raw) as BiometricMetadata;
      return value?.deviceUid ? value : null;
    } catch {
      localStorage.removeItem(BIOMETRIC_META_KEY);
      return null;
    }
  }

  private writeBiometricMetadata(metadata: BiometricMetadata): void {
    localStorage.setItem(BIOMETRIC_META_KEY, JSON.stringify(metadata));
  }

  private biometryLabel(type: BiometryType): string {
    switch (type) {
      case BiometryType.FACE_ID:
      case BiometryType.FACE_AUTHENTICATION:
        return 'Reconocimiento facial';
      case BiometryType.TOUCH_ID:
      case BiometryType.FINGERPRINT:
        return 'Huella digital';
      case BiometryType.MULTIPLE:
        return 'Biometria del dispositivo';
      default:
        return 'Biometria';
    }
  }

  private biometryUnavailableReason(errorCode?: BiometricAuthError): string {
    if (errorCode === BiometricAuthError.BIOMETRICS_NOT_ENROLLED) {
      return 'Registra una huella o rostro en la configuracion del dispositivo.';
    }
    if (errorCode === BiometricAuthError.PASSCODE_NOT_SET) {
      return 'Configura primero un bloqueo seguro en el dispositivo.';
    }
    return 'Este dispositivo no ofrece biometria fuerte disponible.';
  }

  private isRejectedBiometricCredential(error: unknown): boolean {
    if (error instanceof HttpErrorResponse) {
      return error.status === 401 || error.status === 403;
    }
    return Number((error as { code?: number | string })?.code)
      === BiometricAuthError.NO_PROTECTED_CREDENTIALS_FOUND;
  }

  private isExpired(expiresAt: string): boolean {
    return !!expiresAt && new Date(expiresAt).getTime() <= Date.now();
  }

  private closeGoogleSession(email: string | null): void {
    const close = () => {
      const googleAccounts = (window as unknown as {
        google?: {
          accounts?: {
            id?: {
              disableAutoSelect?: () => void;
              revoke?: (email: string, done: () => void) => void;
            };
          };
        };
      }).google?.accounts?.id;

      googleAccounts?.disableAutoSelect?.();

      if (email) {
        googleAccounts?.revoke?.(email, () => undefined);
      }
    };

    if ((window as unknown as { google?: unknown }).google) {
      close();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');

    if (existingScript) {
      existingScript.addEventListener('load', close, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = close;
    document.head.appendChild(script);
  }

  private closeNativeGoogleSession(): void {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    void SocialLogin.logout({ provider: 'google' }).catch(() => undefined);
  }
}
