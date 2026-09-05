import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, NgZone, computed, effect, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { BiometricAuthError } from '@capgo/capacitor-native-biometric';
import { App } from '@capacitor/app';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { AuthService } from './auth.service';
import { SessionLockReason, SessionLockStateService } from './session-lock-state.service';

const BACKGROUND_LOCK_DELAY_MS = 10 * 60 * 1000;
const BACKGROUND_AT_KEY = 'seclife.mobile.auth.backgroundAt';

type UnlockMethod = 'CHECKING' | 'BIOMETRIC' | 'DEVICE_CREDENTIAL' | 'LOGIN';

@Injectable({
  providedIn: 'root',
})
export class SessionSecurityService {
  readonly locked = this.lockState.locked;
  readonly busy = this.lockState.busy;
  readonly error = this.lockState.error;
  readonly message = this.lockState.message;
  private readonly unlockMethodSignal = signal<UnlockMethod>('CHECKING');
  readonly unlockMethod = this.unlockMethodSignal.asReadonly();
  readonly canUnlockLocally = computed(() =>
    this.unlockMethodSignal() === 'BIOMETRIC'
    || this.unlockMethodSignal() === 'DEVICE_CREDENTIAL'
  );
  readonly unlockActionLabel = computed(() => {
    switch (this.unlockMethodSignal()) {
      case 'BIOMETRIC':
        return 'Desbloquear con biometria';
      case 'DEVICE_CREDENTIAL':
        return 'Desbloquear con el dispositivo';
      case 'CHECKING':
        return 'Revisando seguridad';
      default:
        return 'Volver a iniciar sesion';
    }
  });
  readonly unlockActionIcon = computed(() =>
    this.unlockMethodSignal() === 'DEVICE_CREDENTIAL'
      ? 'keypad-outline'
      : 'finger-print-outline'
  );
  readonly alternativeActionLabel = computed(() =>
    this.canUnlockLocally() ? 'Ingresar con otro metodo' : 'Ir al inicio de sesion'
  );

  private initialized = false;
  private appStateListener: PluginListenerHandle | null = null;
  private expiryTimerId: number | undefined;
  private capabilityRequestId = 0;

  constructor(
    private readonly authService: AuthService,
    private readonly lockState: SessionLockStateService,
    private readonly router: Router,
    private readonly ngZone: NgZone
  ) {
    effect(() => {
      const expiresAt = this.authService.session()?.expiresAt ?? null;
      untracked(() => this.scheduleSessionExpiry(expiresAt));
    });
    effect(() => {
      const locked = this.lockState.locked();
      const reason = this.lockState.reason();
      untracked(() => {
        if (locked) {
          void this.refreshUnlockMethod(reason);
        }
      });
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    if (Capacitor.isNativePlatform()) {
      this.appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
        this.ngZone.run(() => this.handleAppStateChange(isActive));
      });
      return;
    }

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  async unlock(): Promise<void> {
    if (this.lockState.busy()) {
      return;
    }

    this.lockState.setBusy(true);
    this.lockState.setError(null);

    try {
      const requiresNewSession =
        this.lockState.reason() === 'SESSION_EXPIRED'
        || this.lockState.reason() === 'UNAUTHORIZED'
        || !this.authService.isAuthenticated();

      switch (this.unlockMethodSignal()) {
        case 'BIOMETRIC':
          if (requiresNewSession) {
            await this.authService.loginWithBiometric();
          } else {
            await this.authService.verifyBiometricIdentity();
          }
          break;
        case 'DEVICE_CREDENTIAL':
          if (requiresNewSession) {
            throw new Error('La sesion vencio. Ingresa nuevamente para renovarla.');
          }
          await this.authService.verifyDeviceCredentialIdentity();
          break;
        case 'LOGIN':
          await this.useAlternativeLogin();
          return;
        default:
          return;
      }

      this.lockState.release();
    } catch (error) {
      const code = Number((error as { code?: number | string })?.code);
      if (code === BiometricAuthError.USER_CANCEL || code === BiometricAuthError.USER_FALLBACK) {
        return;
      }
      this.lockState.setError(this.describeUnlockError(error));
    } finally {
      this.lockState.setBusy(false);
    }
  }

  async useAlternativeLogin(): Promise<void> {
    this.lockState.release();
    this.authService.clearSessionPreservingBiometricAccess();
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  reset(): void {
    localStorage.removeItem(BACKGROUND_AT_KEY);
    this.lockState.release();
  }

  private async refreshUnlockMethod(reason: SessionLockReason | null): Promise<void> {
    const requestId = ++this.capabilityRequestId;
    this.unlockMethodSignal.set('CHECKING');

    const capability = await this.authService.getBiometricCapability();
    if (requestId !== this.capabilityRequestId || !this.lockState.locked()) {
      return;
    }

    const requiresNewSession =
      reason === 'SESSION_EXPIRED'
      || reason === 'UNAUTHORIZED'
      || !this.authService.isAuthenticated();

    if (capability.configured) {
      this.unlockMethodSignal.set('BIOMETRIC');
      return;
    }

    if (!requiresNewSession && capability.deviceCredentialAvailable) {
      this.unlockMethodSignal.set('DEVICE_CREDENTIAL');
      return;
    }

    this.unlockMethodSignal.set('LOGIN');
  }

  private readonly handleVisibilityChange = (): void => {
    this.handleAppStateChange(!document.hidden);
  };

  private handleAppStateChange(isActive: boolean): void {
    if (!this.authService.session()) {
      localStorage.removeItem(BACKGROUND_AT_KEY);
      return;
    }

    if (!isActive) {
      if (!localStorage.getItem(BACKGROUND_AT_KEY)) {
        localStorage.setItem(BACKGROUND_AT_KEY, Date.now().toString());
      }
      return;
    }

    const backgroundAtRaw = localStorage.getItem(BACKGROUND_AT_KEY);
    localStorage.removeItem(BACKGROUND_AT_KEY);

    if (!this.authService.isAuthenticated()) {
      this.lockState.requestLock('SESSION_EXPIRED');
      return;
    }

    const backgroundAt = backgroundAtRaw === null ? null : Number(backgroundAtRaw);
    if (
      backgroundAt !== null
      && Number.isFinite(backgroundAt)
      && Date.now() - backgroundAt >= BACKGROUND_LOCK_DELAY_MS
    ) {
      this.lockState.requestLock('BACKGROUND_TIMEOUT');
    }
  }

  private scheduleSessionExpiry(expiresAt: string | null): void {
    if (this.expiryTimerId !== undefined) {
      window.clearTimeout(this.expiryTimerId);
      this.expiryTimerId = undefined;
    }

    if (!expiresAt) {
      return;
    }

    const expiresAtMs = new Date(expiresAt).getTime();
    if (!Number.isFinite(expiresAtMs)) {
      return;
    }

    const delay = expiresAtMs - Date.now();
    if (delay <= 0) {
      this.lockState.requestLock('SESSION_EXPIRED');
      return;
    }

    this.expiryTimerId = window.setTimeout(() => {
      this.expiryTimerId = undefined;
      if (this.authService.session()) {
        this.ngZone.run(() => this.lockState.requestLock('SESSION_EXPIRED'));
      }
    }, delay);
  }

  private describeUnlockError(error: unknown): string {
    const code = Number((error as { code?: number | string })?.code);
    if (code === BiometricAuthError.NO_PROTECTED_CREDENTIALS_FOUND) {
      return 'La credencial biometrica dejo de ser valida, posiblemente por un cambio en Touch ID o Face ID. Ingresa con otro metodo y activala nuevamente.';
    }

    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Se requiere conexion a internet para renovar la sesion.';
      }
      if (error.status === 401 || error.status === 403) {
        return 'El acceso biometrico vencio o fue revocado. Ingresa con otro metodo.';
      }
    }

    return error instanceof Error && error.message
      ? error.message
      : 'No fue posible desbloquear Seclife. Intenta nuevamente.';
  }
}
