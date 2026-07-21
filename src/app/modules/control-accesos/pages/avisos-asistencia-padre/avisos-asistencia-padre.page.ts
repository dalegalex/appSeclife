import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { RedFamiliarRow } from '../../models/red-familiar.model';
import { AvisoAsistencia } from '../../models/aviso-asistencia.model';
import { AvisoAsistenciaService } from '../../services/aviso-asistencia.service';
import { RedFamiliarService } from '../../services/red-familiar.service';

type AvisoForm = {
  idmatricula: number | null;
  tipoPermiso: string;
  fecha: string;
  fechaInicio: string;
  fechaFin: string;
  motivo: string;
  comentariosSolicitud: string;
};

@Component({
  selector: 'app-avisos-asistencia-padre',
  templateUrl: './avisos-asistencia-padre.page.html',
  styleUrls: ['./avisos-asistencia-padre.page.scss'],
  standalone: false,
})
export class AvisosAsistenciaPadrePage implements OnInit {
  loading = false;
  saving = false;
  cancellingAvisoId: number | null = null;
  alumnos: RedFamiliarRow[] = [];
  avisos: AvisoAsistencia[] = [];
  selectedFile: File | null = null;

  form: AvisoForm = this.createForm();

  constructor(
    private readonly authService: AuthService,
    private readonly redFamiliarService: RedFamiliarService,
    private readonly avisoAsistenciaService: AvisoAsistenciaService,
    private readonly alertController: AlertController,
    private readonly toastController: ToastController
  ) {}

  ngOnInit(): void {
    this.cargarAlumnos();
  }

  get idorg(): number {
    return this.authService.getCurrentUser()?.idorg ?? 0;
  }

  get esAusencia(): boolean {
    return this.form.tipoPermiso === 'AUSENCIA_JUSTIFICADA';
  }

  cargarAlumnos(): void {
    if (!this.idorg) {
      void this.showToast('No se pudo identificar la organizacion.');
      return;
    }

    this.loading = true;
    this.redFamiliarService.consultarAlumnosNucleo(this.idorg).subscribe({
      next: (rows) => {
        this.loading = false;
        this.alumnos = this.normalizeAlumnos(rows);
        this.form.idmatricula = this.alumnos[0]?.idmatricula ?? null;
        this.cargarAvisos();
      },
      error: (error) => {
        this.loading = false;
        void this.showToast(error?.message || 'No fue posible cargar tus alumnos.');
      },
    });
  }

  cargarAvisos(): void {
    if (!this.idorg) return;

    this.avisoAsistenciaService.listar(this.idorg, this.form.idmatricula).subscribe({
      next: (avisos) => {
        this.avisos = avisos;
      },
      error: () => {
        this.avisos = [];
      },
    });
  }

  async enviar(): Promise<void> {
    if (!this.idorg || !this.form.idmatricula) {
      void this.showToast('Selecciona un alumno.');
      return;
    }

    if (this.esAusencia && (!this.form.fechaInicio || !this.form.fechaFin)) {
      void this.showToast('Captura el periodo de ausencia.');
      return;
    }

    if (!this.esAusencia && !this.form.fecha) {
      void this.showToast('Captura la fecha del aviso.');
      return;
    }

    const documentoBase64 = await this.readSelectedFile();

    this.saving = true;
    this.avisoAsistenciaService.crear({
      idorg: this.idorg,
      idmatricula: this.form.idmatricula,
      tipoPermiso: this.form.tipoPermiso,
      fecha: this.esAusencia ? null : this.form.fecha,
      fechaInicio: this.esAusencia ? this.form.fechaInicio : null,
      fechaFin: this.esAusencia ? this.form.fechaFin : null,
      motivo: this.form.motivo.trim() || null,
      comentariosSolicitud: this.form.comentariosSolicitud.trim() || null,
      documentoNombre: this.selectedFile?.name ?? null,
      documentoContentType: this.selectedFile?.type || null,
      documentoTamanoBytes: this.selectedFile?.size ?? null,
      documentoBase64,
    }).subscribe({
      next: () => {
        this.saving = false;
        void this.showToast('Aviso enviado al Colegio.');
        const idmatricula = this.form.idmatricula;
        this.form = this.createForm();
        this.form.idmatricula = idmatricula;
        this.selectedFile = null;
        this.cargarAvisos();
      },
      error: (error) => {
        this.saving = false;
        void this.showToast(error?.message || 'No fue posible enviar el aviso.');
      },
    });
  }

  onAlumnoChange(): void {
    this.cargarAvisos();
  }

  puedeCancelar(aviso: AvisoAsistencia): boolean {
    return (aviso.estatus || '').toUpperCase() === 'SOLICITADO';
  }

  async confirmarCancelar(aviso: AvisoAsistencia): Promise<void> {
    if (!this.puedeCancelar(aviso)) return;

    const alert = await this.alertController.create({
      header: 'Cancelar aviso',
      message: 'La solicitud se cancelará y ya no quedará pendiente de autorización por el Colegio.',
      buttons: [
        {
          text: 'Conservar',
          role: 'cancel',
        },
        {
          text: 'Cancelar aviso',
          role: 'destructive',
          handler: () => this.cancelarAviso(aviso),
        },
      ],
    });

    await alert.present();
  }

  private cancelarAviso(aviso: AvisoAsistencia): void {
    if (!this.idorg || !aviso.idpermisoalumno) return;

    this.cancellingAvisoId = aviso.idpermisoalumno;
    this.avisoAsistenciaService.cancelar(this.idorg, aviso.idpermisoalumno).subscribe({
      next: (updated) => {
        this.cancellingAvisoId = null;
        this.avisos = this.avisos.map((item) =>
          item.idpermisoalumno === aviso.idpermisoalumno
            ? {
                ...item,
                ...(updated ?? {}),
                estatus: updated?.estatus || 'CANCELADO',
                comentariosResolucion: updated?.comentariosResolucion || 'Solicitud cancelada por el padre de familia.',
              }
            : item
        );
        void this.showToast('Aviso cancelado.');
      },
      error: (error) => {
        this.cancellingAvisoId = null;
        void this.showToast(error?.message || 'No fue posible cancelar el aviso.');
      },
    });
  }

  private normalizeAlumnos(rows: RedFamiliarRow[]): RedFamiliarRow[] {
    const byMatricula = new Map<number, RedFamiliarRow>();

    for (const row of rows) {
      const idmatricula = Number(row.idmatricula ?? 0);
      if (!idmatricula) continue;

      const current = byMatricula.get(idmatricula);
      if (!current || this.isNucleo(row) || (!this.isNucleo(current) && (row.alumno || '').localeCompare(current.alumno || '') < 0)) {
        byMatricula.set(idmatricula, row);
      }
    }

    return Array.from(byMatricula.values()).sort((a, b) => (a.alumno || '').localeCompare(b.alumno || ''));
  }

  private isNucleo(row: RedFamiliarRow): boolean {
    const tipo = `${row.tipoRelacion || ''}`.toUpperCase();
    const descripcion = `${row.tipoRelacionDescripcion || ''}`.toUpperCase();
    return tipo === 'FAMILIA_NUCLEO' || descripcion.includes('NUCLEO') || descripcion.includes('NÚCLEO');
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  statusColor(aviso: AvisoAsistencia): string {
    const estatus = (aviso.estatus || '').toUpperCase();
    if (estatus === 'AUTORIZADO') return 'success';
    if (estatus === 'RECHAZADO') return 'danger';
    if (estatus === 'CANCELADO') return 'medium';
    return 'warning';
  }

  tipoPermisoLabel(tipoPermiso?: string | null): string {
    const tipo = (tipoPermiso || '').toUpperCase();
    if (tipo === 'RETARDO_JUSTIFICADO') return 'Ingreso tardío';
    if (tipo === 'SALIDA_TEMPRANA') return 'Salida temprana';
    if (tipo === 'AUSENCIA_JUSTIFICADA') return 'Falta justificada';
    return tipoPermiso || 'Aviso de asistencia';
  }

  fechaProgramadaLabel(aviso: AvisoAsistencia): string {
    const inicio = this.formatDate(aviso.fechaHoraInicio);
    const fin = this.formatDate(aviso.fechaHoraFin);

    if (!inicio && !fin) return 'Sin fecha programada';
    if (inicio && fin && inicio !== fin) return 'Programado del ' + inicio + ' al ' + fin;
    return 'Programado para ' + (inicio || fin);
  }

  hasDocumento(aviso: AvisoAsistencia): boolean {
    return !!(aviso.documentoNombre || aviso.documentoUrl);
  }

  documentoLabel(aviso: AvisoAsistencia): string {
    return aviso.documentoNombre || 'Justificante adjunto';
  }

  private formatDate(value?: string | null): string {
    if (!value) return '';
    const datePart = value.includes('T') ? value.split('T')[0] : value.slice(0, 10);
    const parts = datePart.split('-');
    if (parts.length !== 3) return value;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  private createForm(): AvisoForm {
    const today = new Date().toISOString().slice(0, 10);
    return {
      idmatricula: null,
      tipoPermiso: 'RETARDO_JUSTIFICADO',
      fecha: today,
      fechaInicio: today,
      fechaFin: today,
      motivo: '',
      comentariosSolicitud: '',
    };
  }

  private readSelectedFile(): Promise<string | null> {
    if (!this.selectedFile) {
      return Promise.resolve(null);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => reject(new Error('No fue posible leer el justificante.'));
      reader.readAsDataURL(this.selectedFile as File);
    });
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2200,
      position: 'bottom',
    });
    await toast.present();
  }
}
