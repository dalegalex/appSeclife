import { Component, OnInit, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BiometricAuthError } from '@capgo/capacitor-native-biometric';
import { AlertController } from '@ionic/angular';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-seguridad',
  templateUrl: './seguridad.page.html',
  styleUrls: ['./seguridad.page.scss'],
  standalone: false,
})
export class SeguridadPage implements OnInit {
  readonly loading = signal(true);
  readonly supportBusy = signal(false);
  readonly error = signal<string | null>(null);
  readonly supportCode = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{8}$/)]
  });
  readonly capability = signal({
    available: false,
    configured: false,
    label: 'Biometria',
    reason: null as string | null,
  });

  constructor(
    public readonly authService: AuthService,
    private readonly alertController: AlertController,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    if (this.authService.isSupportSession()) {
      this.loading.set(false);
      return;
    }
    void this.refresh();
  }

  get canActivateSupport(): boolean {
    return [1, 2, 3].includes(this.authService.getCurrentProfileId() ?? 0)
      && !this.authService.isSupportSession();
  }

  activateSupport(): void {
    if (this.supportCode.invalid) {
      this.supportCode.markAsTouched();
      return;
    }
    this.supportBusy.set(true);
    this.error.set(null);
    this.authService.activateSupportSession(this.supportCode.value)
      .pipe(finalize(() => this.supportBusy.set(false)))
      .subscribe({
        next: () => {
          this.authService.loadAppMenu(true).subscribe();
          void this.router.navigateByUrl('/home', { replaceUrl: true });
        },
        error: error => this.error.set(this.errorMessage(error))
      });
  }

  endSupport(): void {
    this.supportBusy.set(true);
    this.error.set(null);
    this.authService.endSupportSession()
      .pipe(finalize(() => this.supportBusy.set(false)))
      .subscribe({
        next: () => void this.router.navigateByUrl('/home', { replaceUrl: true }),
        error: () => void this.router.navigateByUrl('/home', { replaceUrl: true })
      });
  }

  async enable(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try { this.capability.set(await this.authService.enableBiometricAccess()); }
    catch (error) { if (!this.isCancellation(error)) this.error.set(this.errorMessage(error)); }
    finally { this.loading.set(false); }
  }

  async confirmDisable(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Desactivar acceso biometrico',
      message: 'En el siguiente ingreso deberas utilizar Google o solicitar un nuevo codigo por correo.',
      buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Desactivar', role: 'destructive' }],
    });
    await alert.present();
    if ((await alert.onDidDismiss()).role !== 'destructive') return;
    this.loading.set(true);
    this.error.set(null);
    try { await this.authService.disableBiometricAccess(); await this.refresh(); }
    catch (error) { this.error.set(this.errorMessage(error)); this.loading.set(false); }
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    this.capability.set(await this.authService.getBiometricCapability());
    this.loading.set(false);
  }

  private isCancellation(error: unknown): boolean {
    const code = Number((error as { code?: number | string })?.code);
    return code === BiometricAuthError.USER_CANCEL || code === BiometricAuthError.USER_FALLBACK;
  }

  private errorMessage(error: unknown): string {
    return (error as { error?: { message?: string; detail?: string }; message?: string })?.error?.message
      ?? (error as { error?: { detail?: string } })?.error?.detail
      ?? (error as { message?: string })?.message
      ?? 'No fue posible actualizar la seguridad de la cuenta.';
  }
}
