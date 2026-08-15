import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { EventoInvitacionFamiliar } from '../../models/evento-invitacion.model';
import { EventoInvitacionService } from '../../services/evento-invitacion.service';

@Component({
  selector: 'app-eventos-familiares',
  templateUrl: './eventos-familiares.page.html',
  styleUrls: ['./eventos-familiares.page.scss'],
  standalone: false,
})
export class EventosFamiliaresPage implements OnInit {
  loading = false;
  savingId: number | null = null;
  editingId: number | null = null;
  invitaciones: EventoInvitacionFamiliar[] = [];
  acompanantes: string[] = [];
  comentarios = '';

  constructor(
    private readonly service: EventoInvitacionService,
    private readonly toastController: ToastController
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.service.consultarMias().subscribe({
      next: (invitaciones) => {
        this.loading = false;
        this.invitaciones = invitaciones;
      },
      error: (error) => {
        this.loading = false;
        this.invitaciones = [];
        void this.showToast(error?.message || 'No fue posible consultar los eventos.', 'danger');
      },
    });
  }

  editar(invitacion: EventoInvitacionFamiliar): void {
    if (this.estaCancelada(invitacion)) {
      void this.showToast('El evento fue cancelado y ya no admite respuestas.', 'warning');
      return;
    }
    this.editingId = invitacion.idinvitacion;
    this.acompanantes = (invitacion.acompanantes ?? []).map(
      (item) => this.normalizarNombre(item.nombreCompleto)
    );
    this.comentarios = '';
  }

  cancelarEdicion(): void {
    this.editingId = null;
    this.acompanantes = [];
    this.comentarios = '';
  }

  agregarAcompanante(invitacion: EventoInvitacionFamiliar): void {
    const maximo = this.maximoAcompanantes(invitacion);
    if (this.acompanantes.length >= maximo) {
      void this.showToast('El maximo es de ' + maximo + ' acompanante(s).', 'warning');
      return;
    }
    this.acompanantes.push('');
  }

  quitarAcompanante(index: number): void {
    this.acompanantes.splice(index, 1);
  }

  actualizarAcompanante(index: number, value: string | null | undefined): void {
    this.acompanantes[index] = this.normalizarNombre(value);
  }

  confirmar(invitacion: EventoInvitacionFamiliar): void {
    if (this.estaCancelada(invitacion)) return;
    const nombres = this.acompanantes
      .map((nombre) => this.normalizarNombre(nombre))
      .filter((nombre) => !!nombre);

    if (nombres.length !== this.acompanantes.length) {
      void this.showToast('Captura el nombre completo de cada acompanante.', 'warning');
      return;
    }

    if (nombres.length > this.maximoAcompanantes(invitacion)) {
      void this.showToast('El numero de acompanantes excede el limite del evento.', 'warning');
      return;
    }

    this.responder(invitacion, 'CONFIRMADA', nombres);
  }

  declinar(invitacion: EventoInvitacionFamiliar): void {
    if (this.estaCancelada(invitacion)) return;
    this.responder(invitacion, 'DECLINADA', []);
  }

  estaCancelada(invitacion: EventoInvitacionFamiliar): boolean {
    return invitacion.estatusEvento === 'CANCELADO' || invitacion.estatusInvitacion === 'CANCELADA';
  }

  fechaLabel(invitacion: EventoInvitacionFamiliar): string {
    const fecha = invitacion.fechaEvento?.slice(0, 10) ?? '';
    const hora = invitacion.horaProgramada?.slice(0, 5) ?? '';
    return `${fecha} ${hora}`.trim();
  }

  respuestaColor(invitacion: EventoInvitacionFamiliar): string {
    if (invitacion.estatusRespuesta === 'CONFIRMADA') return 'success';
    if (invitacion.estatusRespuesta === 'DECLINADA') return 'medium';
    return invitacion.confirmacionRequerida ? 'danger' : 'warning';
  }

  maximoAcompanantes(invitacion: EventoInvitacionFamiliar): number {
    const participantes = Number(invitacion.maxParticipantesFamilia ?? 0);
    return participantes > 0 ? Math.max(0, Math.min(19, participantes - 1)) : 19;
  }

  private responder(
    invitacion: EventoInvitacionFamiliar,
    estatusRespuesta: 'CONFIRMADA' | 'DECLINADA',
    acompanantes: string[]
  ): void {
    if (this.estaCancelada(invitacion)) return;
    this.savingId = invitacion.idinvitacion;
    this.service
      .responder(invitacion.idinvitacion, {
        estatusRespuesta,
        acompanantes: acompanantes.map((nombreCompleto) => ({ nombreCompleto })),
        comentarios: this.comentarios.trim() || null,
      })
      .subscribe({
        next: () => {
          this.savingId = null;
          this.cancelarEdicion();
          void this.showToast(
            estatusRespuesta === 'CONFIRMADA'
              ? 'Asistencia confirmada.'
              : 'Invitacion declinada.',
            'success'
          );
          this.cargar();
        },
        error: (error) => {
          this.savingId = null;
          void this.showToast(
            error?.message || 'No fue posible guardar la respuesta.',
            'danger'
          );
        },
      });
  }

  private normalizarNombre(value: string | null | undefined): string {
    return (value ?? '').toLocaleUpperCase('es-MX');
  }

  private async showToast(
    message: string,
    color: 'success' | 'warning' | 'danger' = 'warning'
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      color,
      duration: 2600,
      position: 'bottom',
    });
    await toast.present();
  }
}
