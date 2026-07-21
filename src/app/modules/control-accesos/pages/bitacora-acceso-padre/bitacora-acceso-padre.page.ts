import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../../../../core/auth/auth.service';
import {
  BitacoraAccesoEvento,
  BitacoraAccesoResponse,
  BitacoraAlumnoOption,
} from '../../models/bitacora-acceso.model';
import { RedFamiliarRow } from '../../models/red-familiar.model';
import { BitacoraAccesoService } from '../../services/bitacora-acceso.service';
import { RedFamiliarService } from '../../services/red-familiar.service';

@Component({
  selector: 'app-bitacora-acceso-padre',
  templateUrl: './bitacora-acceso-padre.page.html',
  styleUrls: ['./bitacora-acceso-padre.page.scss'],
  standalone: false,
})
export class BitacoraAccesoPadrePage implements OnInit {
  loadingAlumnos = false;
  loadingBitacora = false;
  alumnos: BitacoraAlumnoOption[] = [];
  selectedIdmatricula: number | null = null;
  fechaInicio = this.addDays(this.today(), -7);
  fechaFin = this.today();
  bitacora: BitacoraAccesoResponse | null = null;

  constructor(
    private readonly authService: AuthService,
    private readonly redFamiliarService: RedFamiliarService,
    private readonly bitacoraAccesoService: BitacoraAccesoService,
    private readonly toastController: ToastController
  ) {}

  ngOnInit(): void {
    this.cargarAlumnos();
  }

  get idorg(): number {
    return this.authService.getCurrentUser()?.idorg ?? 0;
  }

  get eventos(): BitacoraAccesoEvento[] {
    return this.bitacora?.eventos ?? [];
  }

  cargarAlumnos(): void {
    if (!this.idorg) {
      void this.showToast('No se pudo identificar la organizacion.');
      return;
    }

    this.loadingAlumnos = true;
    this.redFamiliarService.consultarMiRed(this.idorg).subscribe({
      next: (rows) => {
        this.alumnos = this.buildAlumnoOptions(rows);
        this.selectedIdmatricula = this.alumnos[0]?.idmatricula ?? null;
        this.loadingAlumnos = false;

        if (this.selectedIdmatricula) {
          this.consultar();
        }
      },
      error: (error) => {
        this.loadingAlumnos = false;
        void this.showToast(error?.message || 'No fue posible cargar tus alumnos.');
      },
    });
  }

  consultar(): void {
    if (!this.idorg || !this.selectedIdmatricula) {
      void this.showToast('Selecciona un alumno para consultar.');
      return;
    }

    if (!this.fechaInicio || !this.fechaFin || this.fechaFin < this.fechaInicio) {
      void this.showToast('Revisa el periodo de consulta.');
      return;
    }

    this.loadingBitacora = true;
    this.bitacoraAccesoService.consultarAlumno(
      this.idorg,
      this.selectedIdmatricula,
      this.fechaInicio,
      this.fechaFin
    ).subscribe({
      next: (bitacora) => {
        this.bitacora = bitacora;
        this.loadingBitacora = false;
      },
      error: (error) => {
        this.loadingBitacora = false;
        void this.showToast(error?.message || 'No fue posible consultar la bitacora.');
      },
    });
  }

  onAlumnoChange(value: number | string | null | undefined): void {
    const idmatricula = Number(value);
    this.selectedIdmatricula = Number.isFinite(idmatricula) && idmatricula > 0 ? idmatricula : null;
    this.consultarSiListo();
  }

  onPeriodoChange(): void {
    this.consultarSiListo();
  }

  sentidoColor(evento: BitacoraAccesoEvento): string {
    return (evento.sentido || '').toUpperCase() === 'ENTRADA' ? 'success' : 'primary';
  }

  modoLabel(evento: BitacoraAccesoEvento): string {
    const modo = (evento.modoSalida || evento.fuente || '').toUpperCase();

    switch (modo) {
      case 'ENTRADA':
        return 'Entrada';
      case 'CARRUSEL':
        return 'Carrusel';
      case 'ENTREGA_DIRECTA':
        return 'Entrega directa';
      case 'PEATONAL':
        return 'Entrega peatonal';
      case 'OTRO_AUTO':
        return 'Otro auto';
      case 'TRANSPORTE_ESCOLAR':
        return 'Transporte escolar';
      case 'SALIDA_PROPIA':
        return 'Salida propia';
      case 'REGISTRO_MANUAL':
        return 'Registro manual';
      default:
        return evento.sentido || 'Registro';
    }
  }

  trackAlumno(_: number, alumno: BitacoraAlumnoOption): number {
    return alumno.idmatricula;
  }

  trackEvento(_: number, evento: BitacoraAccesoEvento): string {
    return `${evento.fuente || 'EVENTO'}-${evento.idEvento}`;
  }

  private buildAlumnoOptions(rows: RedFamiliarRow[]): BitacoraAlumnoOption[] {
    const map = new Map<number, BitacoraAlumnoOption>();

    for (const row of rows) {
      if (!row.idmatricula || !row.alumno || map.has(row.idmatricula)) {
        continue;
      }

      map.set(row.idmatricula, {
        idmatricula: row.idmatricula,
        alumno: row.alumno,
        matricula: row.matricula,
        gradoGrupo: row.gradoGrupo,
      });
    }

    return [...map.values()].sort((a, b) => a.alumno.localeCompare(b.alumno));
  }

  private consultarSiListo(): void {
    if (this.loadingAlumnos || this.loadingBitacora) {
      return;
    }

    if (this.selectedIdmatricula && this.fechaInicio && this.fechaFin) {
      this.consultar();
    }
  }

  private today(): string {
    const date = new Date();
    return this.formatDate(date);
  }

  private addDays(dateText: string, days: number): string {
    const date = new Date(`${dateText}T12:00:00`);
    date.setDate(date.getDate() + days);
    return this.formatDate(date);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2400,
      position: 'top',
    });
    await toast.present();
  }
}
