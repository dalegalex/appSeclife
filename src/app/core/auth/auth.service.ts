import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { Capacitor } from '@capacitor/core';
import { Observable, catchError, finalize, of, shareReplay, tap } from 'rxjs';
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
} from './auth.models';

const SESSION_KEY = 'seclife.mobile.auth.session';

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

  readonly session = computed(() => this.sessionSignal());
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
    const email = this.getCurrentUser()?.email ?? null;
    localStorage.removeItem(SESSION_KEY);
    this.resetAppMenu();
    this.sessionSignal.set(null);
    this.closeNativeGoogleSession();
    this.closeGoogleSession(email);
  }

  private setSession(session: AuthSession): void {
    this.resetAppMenu();
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.sessionSignal.set(session);
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
      return this.isExpired(session.expiresAt) ? null : session;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
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
