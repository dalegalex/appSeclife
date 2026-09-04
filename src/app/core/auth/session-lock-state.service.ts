import { Injectable, computed, signal } from '@angular/core';

export type SessionLockReason =
  | 'BACKGROUND_TIMEOUT'
  | 'SESSION_EXPIRED'
  | 'UNAUTHORIZED';

@Injectable({
  providedIn: 'root',
})
export class SessionLockStateService {
  private readonly lockedSignal = signal(false);
  private readonly reasonSignal = signal<SessionLockReason | null>(null);
  private readonly busySignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly locked = computed(() => this.lockedSignal());
  readonly reason = computed(() => this.reasonSignal());
  readonly busy = computed(() => this.busySignal());
  readonly error = computed(() => this.errorSignal());
  readonly message = computed(() => {
    switch (this.reasonSignal()) {
      case 'BACKGROUND_TIMEOUT':
        return 'La aplicacion estuvo inactiva. Confirma tu identidad para continuar.';
      case 'SESSION_EXPIRED':
        return 'Tu sesion vencio. Confirma tu identidad para renovarla de forma segura.';
      case 'UNAUTHORIZED':
        return 'La sesion vencio. Inicia sesion nuevamente para continuar.';
      default:
        return 'Confirma tu identidad para continuar en Seclife.';
    }
  });

  requestLock(reason: SessionLockReason): void {
    this.reasonSignal.set(reason);
    this.errorSignal.set(null);
    this.busySignal.set(false);
    this.lockedSignal.set(true);
  }

  release(): void {
    this.lockedSignal.set(false);
    this.reasonSignal.set(null);
    this.busySignal.set(false);
    this.errorSignal.set(null);
  }

  setBusy(value: boolean): void {
    this.busySignal.set(value);
  }

  setError(message: string | null): void {
    this.errorSignal.set(message);
  }
}
