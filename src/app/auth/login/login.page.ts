import { AfterViewInit, Component, NgZone } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RegistrationCodePreview } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>
          ) => void;
        };
      };
    };
  }
}

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements AfterViewInit {
  readonly isNative = Capacitor.isNativePlatform();
  loading = false;
  errorTitle = '';
  errorMessage = '';
  mode: 'login' | 'register' | 'local' = 'login';
  codereg = '';
  registrationPreview: RegistrationCodePreview | null = null;
  registrationName = '';
  registrationLastName = '';
  registrationFamilyName = '';
  registrationRequiresFamilyName = false;
  registrationPhone = '';
  localLoginEmail = '';
  localLoginCode = '';
  localLoginCodeSent = false;
  localRegisterEmail = '';
  localRegisterCode = '';
  localRegisterCodeSent = false;
  previewLoading = false;
  nativeGoogleUnavailable = false;
  private nativeGoogleInitialized = false;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly zone: NgZone
  ) {}

  ngAfterViewInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigateByUrl('/home', { replaceUrl: true });
      return;
    }

    this.loadGoogleIdentity();
  }

  private loadGoogleIdentity(forceNativeFallback = false): void {
    if (this.isNative && !forceNativeFallback) {
      return;
    }

    if (window.google?.accounts?.id) {
      this.renderGoogleButton();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => this.renderGoogleButton();
    script.onerror = () => {
      this.setError(
        'Google no disponible',
        'No fue posible cargar Google Identity Services. Revisa la conexion a internet e intenta nuevamente.'
      );
    };
    document.head.appendChild(script);
  }

  showNativeGoogleButton(): boolean {
    return this.isNative && !this.nativeGoogleUnavailable;
  }

  showWebGoogleButton(): boolean {
    return !this.isNative || this.nativeGoogleUnavailable;
  }

  async signInWithNativeGoogle(): Promise<void> {
    this.loading = true;
    this.clearError();

    try {
      await this.initializeNativeGoogle();

      const login = await SocialLogin.login({
        provider: 'google',
        options: {
          filterByAuthorizedAccounts: false,
          autoSelectEnabled: false,
        },
      });

      const idToken = login.result.responseType === 'online' ? login.result.idToken : null;

      if (!idToken) {
        this.setError(
          'Credencial incompleta',
          'Google no devolvio una credencial valida. Intenta seleccionar la cuenta nuevamente.'
        );
        return;
      }

      const authenticated = await this.authenticateWithGoogleToken(idToken);

      if (authenticated) {
        this.router.navigateByUrl('/home', { replaceUrl: true });
      }
    } catch (error) {
      const code = (error as { code?: string })?.code;

      if (code !== 'USER_CANCELLED') {
        if (this.isMissingGoogleCredentialProviderError(error)) {
          this.nativeGoogleUnavailable = true;
          this.nativeGoogleInitialized = false;
          this.setError(
            'Google no disponible en el dispositivo',
            'La terminal no encontro el proveedor nativo de credenciales de Google. Se habilito el acceso alterno con Google en pantalla.'
          );
          this.loadGoogleIdentity(true);
          setTimeout(() => this.renderGoogleButton());
          return;
        }

        this.applyAuthError(error);
      }
    } finally {
      this.loading = false;
    }
  }

  private async initializeNativeGoogle(): Promise<void> {
    if (this.nativeGoogleInitialized) {
      return;
    }

    await SocialLogin.initialize({
      google: {
        webClientId: environment.googleClientId,
        iOSClientId: environment.googleIosClientId,
        iOSServerClientId: environment.googleClientId,
        mode: 'online',
      },
    });

    this.nativeGoogleInitialized = true;
  }

  private isMissingGoogleCredentialProviderError(error: unknown): boolean {
    const text = [
      (error as { message?: string })?.message,
      (error as { errorMessage?: string })?.errorMessage,
      (error as { code?: string })?.code,
      String(error ?? ''),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return text.includes('getcredentialasync')
      || text.includes('no provider dependencies')
      || text.includes('provider dependencies')
      || text.includes('no provider');
  }

  private renderGoogleButton(): void {
    const buttonHost = document.getElementById('googleLoginButton');

    if (!buttonHost || !window.google?.accounts?.id) {
      return;
    }

    window.google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response) => this.zone.run(() => this.handleGoogleCredential(response.credential)),
      auto_select: false,
    });

    window.google.accounts.id.renderButton(buttonHost, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      text: 'signin_with',
      logo_alignment: 'left',
      width: 300,
    });
  }

  private handleGoogleCredential(credential?: string): void {
    if (!credential) {
      this.setError(
        'Credencial incompleta',
        'Google no devolvio una credencial valida. Intenta seleccionar la cuenta nuevamente.'
      );
      return;
    }

    this.loading = true;
    this.clearError();

    const authRequest = this.mode === 'register'
      ? this.authService.registerWithCode(this.buildRegisterRequest(credential))
      : this.authService.loginWithGoogle(credential);

    authRequest.subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl('/home', { replaceUrl: true });
      },
      error: (error) => {
        this.loading = false;
        this.applyAuthError(error);
      },
    });
  }

  setMode(mode: 'login' | 'register' | 'local'): void {
    this.mode = mode;
    this.clearError();

    if (mode !== 'register') {
      this.registrationPreview = null;
      this.registrationName = '';
      this.registrationLastName = '';
      this.registrationFamilyName = '';
      this.registrationRequiresFamilyName = false;
      this.registrationPhone = '';
      this.localRegisterEmail = '';
      this.localRegisterCode = '';
      this.localRegisterCodeSent = false;
    }

    if (mode === 'login') {
      setTimeout(() => this.renderGoogleButton());
    }
  }

  previewCode(): void {
    const code = this.codereg.trim().toUpperCase();

    if (!code) {
      this.setError('Codigo requerido', 'Captura el codigo de registro proporcionado por el Colegio.');
      return;
    }

    this.previewLoading = true;
    this.registrationPreview = null;
    this.registrationRequiresFamilyName = false;
    this.clearError();

    this.authService.previewRegistrationCode(code).subscribe({
      next: (preview) => {
        this.previewLoading = false;
        this.registrationPreview = preview;
        this.registrationRequiresFamilyName = this.resolveRegistrationFamilyNameRequired(preview);
        this.registrationName = this.toUpper(preview.nombre) ?? '';
        this.registrationLastName = this.toUpper(preview.apellidos) ?? '';
        this.registrationFamilyName = this.registrationRequiresFamilyName ? (this.toUpper(preview.apellidos) ?? '') : '';
        this.registrationPhone = preview.cel ?? '';

        setTimeout(() => this.renderGoogleButton());
      },
      error: (error) => {
        this.previewLoading = false;
        this.applyAuthError(error);
      },
    });
  }

  canAssociateAccount(ignoreLoading = false): boolean {
    if (!this.registrationPreview || (!ignoreLoading && this.loading) || this.previewLoading) {
      return false;
    }

    if (!this.registrationPreview.requiereDatos) {
      return !this.registrationRequiresFamilyName || !!this.registrationFamilyName.trim();
    }

    return !!this.registrationName.trim()
      && !!this.registrationLastName.trim()
      && (!this.registrationRequiresFamilyName || !!this.registrationFamilyName.trim())
      && !!this.registrationPhone.trim();
  }

  startLocalLogin(): void {
    const email = this.localLoginEmail.trim().toLowerCase();
    if (!email) {
      this.setError('Correo requerido', 'Captura el correo asociado a tu cuenta Seclife.');
      return;
    }

    this.loading = true;
    this.clearError();
    this.authService.startLocalLogin(email).subscribe({
      next: () => {
        this.loading = false;
        this.localLoginCodeSent = true;
      },
      error: (error) => {
        this.loading = false;
        this.applyAuthError(error);
      },
    });
  }

  verifyLocalLogin(): void {
    this.verifyLocalCode(this.localLoginEmail, this.localLoginCode);
  }

  startLocalRegister(): void {
    if (!this.canAssociateAccount(true)) {
      this.setError('Registro incompleto', 'Valida el codigo y completa los datos requeridos antes de asociar el correo.');
      return;
    }

    const email = this.localRegisterEmail.trim().toLowerCase();
    if (!email) {
      this.setError('Correo requerido', 'Captura el correo personal que usaras para ingresar.');
      return;
    }

    this.loading = true;
    this.clearError();
    this.authService.startLocalRegister(this.buildLocalRegisterRequest(email)).subscribe({
      next: () => {
        this.loading = false;
        this.localRegisterCodeSent = true;
      },
      error: (error) => {
        this.loading = false;
        this.applyAuthError(error);
      },
    });
  }

  verifyLocalRegister(): void {
    this.verifyLocalCode(this.localRegisterEmail, this.localRegisterCode);
  }

  getRegistrationTitle(): string {
    const preview = this.registrationPreview;
    if (!preview) {
      return '';
    }

    return [preview.nombre, preview.apellidos].filter(Boolean).join(' ').trim()
      || 'Nuevo usuario Seclife';
  }

  getRegistrationOrganization(): string {
    return this.registrationPreview?.organizaciones?.[0]?.organizacion ?? 'Organizacion Seclife';
  }

  private async authenticateWithGoogleToken(idToken: string): Promise<boolean> {
    if (this.mode === 'register') {
      if (!this.canAssociateAccount(true)) {
        this.setError('Registro incompleto', 'Valida el codigo y completa los datos requeridos antes de asociar Google.');
        return false;
      }

      await firstValueFrom(this.authService.registerWithCode(this.buildRegisterRequest(idToken)));
      return true;
    }

    await firstValueFrom(this.authService.loginWithGoogle(idToken));
    return true;
  }

  private buildRegisterRequest(idToken: string) {
    const preview = this.registrationPreview;

    return {
      codereg: this.codereg.trim().toUpperCase(),
      idToken,
      identidad: preview?.identidad || null,
      idperfil: this.getPreviewProfileId(),
      nombre: preview?.requiereDatos ? this.toUpper(this.registrationName) : this.toUpper(preview?.nombre),
      apellidos: preview?.requiereDatos ? this.toUpper(this.registrationLastName) : this.toUpper(preview?.apellidos),
      nombreFamilia: this.registrationRequiresFamilyName ? this.toUpper(this.registrationFamilyName) : null,
      cel: preview?.requiereDatos ? this.registrationPhone.trim() : preview?.cel,
    };
  }

  private buildLocalRegisterRequest(email: string) {
    const preview = this.registrationPreview;

    return {
      codereg: this.codereg.trim().toUpperCase(),
      email,
      identidad: preview?.identidad || null,
      idperfil: this.getPreviewProfileId(),
      nombre: preview?.requiereDatos ? this.toUpper(this.registrationName) : this.toUpper(preview?.nombre),
      apellidos: preview?.requiereDatos ? this.toUpper(this.registrationLastName) : this.toUpper(preview?.apellidos),
      nombreFamilia: this.registrationRequiresFamilyName ? this.toUpper(this.registrationFamilyName) : null,
      cel: preview?.requiereDatos ? this.registrationPhone.trim() : preview?.cel,
    };
  }

  private verifyLocalCode(email: string, code: string): void {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();
    if (!normalizedEmail || !normalizedCode) {
      this.setError('Codigo requerido', 'Captura el correo y el codigo de verificacion.');
      return;
    }

    this.loading = true;
    this.clearError();
    this.authService.verifyLocalAuth(normalizedEmail, normalizedCode).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl('/home', { replaceUrl: true });
      },
      error: (error) => {
        this.loading = false;
        this.applyAuthError(error);
      },
    });
  }

  isFamilyProfile(idperfil?: number | string | null): boolean {
    return Number(idperfil) === 4;
  }

  isRegistrationFamilyProfile(): boolean {
    return this.registrationRequiresFamilyName;
  }

  shouldShowFamilyNameField(): boolean {
    return this.registrationRequiresFamilyName;
  }

  normalizeUpperField(field: 'registrationName' | 'registrationLastName' | 'registrationFamilyName'): void {
    this[field] = this.toUpper(this[field]) ?? '';
  }

  scheduleGoogleButtonRender(): void {
    if (!this.isNative && this.mode === 'register' && this.canAssociateAccount(true)) {
      setTimeout(() => this.renderGoogleButton());
    }
  }

  private getPreviewProfileId(): number | null {
    return this.getPreviewProfileIdFrom(this.registrationPreview);
  }

  private resolveRegistrationFamilyProfile(preview: RegistrationCodePreview | null): boolean {
    if (!preview) {
      return false;
    }

    const profileId = this.getPreviewProfileIdFrom(preview);
    const profileText = this.normalizeSearchText((preview.perfil ?? '').toString());
    const rawPreviewText = this.normalizeSearchText(JSON.stringify(preview));

    return this.isFamilyProfile(profileId)
      || profileText.includes('FAMILIAR')
      || profileText.includes('PAPA')
      || profileText.includes('PADRE')
      || rawPreviewText.includes('"IDPERFIL":4')
      || rawPreviewText.includes('"IDPERFIL":"4"')
      || rawPreviewText.includes('"ID_PERFIL":4')
      || rawPreviewText.includes('"ID_PERFIL":"4"');
  }

  private resolveRegistrationFamilyNameRequired(preview: RegistrationCodePreview | null): boolean {
    return this.resolveRegistrationFamilyProfile(preview);
  }

  private getPreviewProfileIdFrom(preview: RegistrationCodePreview | null): number | null {
    const previewValue = preview as (RegistrationCodePreview & {
      idPerfil?: number | string | null;
      id_perfil?: number | string | null;
      IdPerfil?: number | string | null;
      IDPERFIL?: number | string | null;
    }) | null;

    const value = previewValue?.idperfil
      ?? previewValue?.idPerfil
      ?? previewValue?.id_perfil
      ?? previewValue?.IdPerfil
      ?? previewValue?.IDPERFIL
      ?? null;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
  }

  private normalizeSearchText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleUpperCase('es-MX');
  }

  private toUpper(value?: string | null): string | null {
    const text = (value ?? '').trim();
    return text ? text.toLocaleUpperCase('es-MX') : null;
  }

  private applyAuthError(error: unknown): void {
    const message = this.extractErrorMessage(error);
    const normalized = message.toLowerCase();

    if (error instanceof HttpErrorResponse && error.status === 0) {
      this.setError(
        'Sin conexion al API',
        `No fue posible conectar con Seclife en ${this.resolveApiUrl()}. Verifica que el API este activo y que adb reverse este configurado.`
      );
      return;
    }

    if (normalized.includes('no esta registrada')) {
      this.setError(
        'Cuenta no registrada',
        'La cuenta Google fue validada, pero no esta registrada en Seclife. Para un usuario nuevo se usara el registro con codigo.'
      );
      return;
    }

    if (normalized.includes('no esta activo')) {
      this.setError(
        'Usuario inactivo',
        'Tu usuario existe en Seclife, pero no se encuentra activo. Solicita al Colegio que revise tu acceso.'
      );
      return;
    }

    if (normalized.includes('bloqueado')) {
      this.setError(
        'Usuario bloqueado',
        'Tu usuario se encuentra bloqueado. Solicita al Colegio que revise el estado de tu cuenta.'
      );
      return;
    }

    if (normalized.includes('aun no tiene una cuenta seclife asociada')) {
      this.setError(
        'Registro pendiente',
        'El codigo de registro existe, pero todavia no tiene una cuenta Seclife asociada. Completa el registro con codigo.'
      );
      return;
    }

    if (normalized.includes('aplicacion autorizada') || normalized.includes('google no valido')) {
      this.setError(
        'Configuracion Google',
        'Google no pudo validar esta aplicacion. Revisa los Client ID y la configuracion de la plataforma en Google Cloud.'
      );
      return;
    }

    if (normalized.includes('network') || normalized.includes('failed to fetch')) {
      this.setError(
        'Sin conexion',
        'No fue posible completar la autenticacion. Revisa la conexion a internet y vuelve a intentar.'
      );
      return;
    }

    this.setError(
      'No fue posible ingresar',
      message || 'No fue posible validar la cuenta en Seclife. Intenta nuevamente.'
    );
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return error.error?.message || error.message || '';
    }

    const candidate = error as { message?: string; error?: { message?: string } };
    return candidate?.error?.message || candidate?.message || '';
  }

  private resolveApiUrl(): string {
    return this.isNative ? environment.androidApiUrl : environment.apiUrl;
  }

  private setError(title: string, message: string): void {
    this.errorTitle = title;
    this.errorMessage = message;
  }

  private clearError(): void {
    this.errorTitle = '';
    this.errorMessage = '';
  }
}
