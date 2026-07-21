import { Component, computed, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import { finalize } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { AccountDeletionResponse } from '../../../../core/auth/auth.models';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-eliminacion-cuenta',
  templateUrl: './eliminacion-cuenta.page.html',
  styleUrls: ['./eliminacion-cuenta.page.scss'],
  standalone: false,
})
export class EliminacionCuentaPage {
  readonly accountDeletionUrl = environment.accountDeletionUrl;
  readonly submitting = signal(false);
  readonly submission = signal<AccountDeletionResponse | null>(null);
  readonly user = computed(() => this.authService.getCurrentUser());
  readonly form = this.fb.nonNullable.group({
    motivo: ['', [Validators.maxLength(500)]],
    confirma: [false, [Validators.requiredTrue]],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly toastController: ToastController
  ) {}

  get displayName(): string {
    return this.authService.getDisplayName();
  }

  get userEmail(): string {
    return this.user()?.email ?? 'Correo no disponible';
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.authService.requestAccountDeletion({
      motivo: this.form.controls.motivo.value.trim() || null,
      origen: 'APPSECLIFE',
    })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: async (response) => {
          this.submission.set(response);
          await this.showToast(`Solicitud registrada. Folio: ${response.folio}`);
        },
        error: async () => {
          await this.showToast('No se pudo registrar la solicitud. Intenta nuevamente o usa la liga web.');
        },
      });
  }

  openWebRequest(): void {
    if (!this.accountDeletionUrl) {
      return;
    }

    window.open(this.accountDeletionUrl, '_blank', 'noopener,noreferrer');
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3200,
      position: 'bottom',
    });
    await toast.present();
  }
}
