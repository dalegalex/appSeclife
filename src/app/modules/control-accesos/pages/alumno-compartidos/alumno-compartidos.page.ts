import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertController, NavController, ToastController } from '@ionic/angular';
import { AuthService } from '../../../../core/auth/auth.service';
import {
  AlumnoCompartido,
  AlumnoFamiliar,
  RedFamiliarRow,
} from '../../models/red-familiar.model';
import { RedFamiliarService } from '../../services/red-familiar.service';

interface FamiliaCompartidaGrupo {
  key: string;
  idfamiliaDestino: number | null;
  familiaDestino: string;
  integrantes: AlumnoCompartido[];
}

@Component({
  selector: 'app-alumno-compartidos',
  templateUrl: './alumno-compartidos.page.html',
  styleUrls: ['./alumno-compartidos.page.scss'],
  standalone: false,
})
export class AlumnoCompartidosPage implements OnInit {
  loading = false;
  alumno: AlumnoFamiliar | null = null;
  rows: RedFamiliarRow[] = [];
  revocando = new Set<number>();
  revocandoFamilias = new Set<number>();

  private idmatricula = 0;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly navController: NavController,
    private readonly alertController: AlertController,
    private readonly toastController: ToastController,
    private readonly authService: AuthService,
    private readonly redFamiliarService: RedFamiliarService
  ) {}

  ngOnInit(): void {
    this.idmatricula = Number(this.route.snapshot.paramMap.get('idmatricula')) || 0;
    this.cargar();
  }

  get idorg(): number {
    return this.authService.getCurrentUser()?.idorg ?? 0;
  }

  get idfamiliaOrigen(): number | null {
    return this.rows.find((row) => row.idmatricula === this.idmatricula && this.esNucleo(row))?.idfamilia ?? null;
  }

  get puedeAdministrar(): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      return false;
    }

    const miembros = this.rows.flatMap((row) => row.miembros ?? []);
    const miembro = miembros.find((item) => item.idusrbt === currentUser.idusrbt && item.sitactivo !== false);
    const familia = this.rows.find((row) => row.idfamilia === this.idfamiliaOrigen);

    return familia?.idusrbtMaster === currentUser.idusrbt
      || miembro?.esMaster === true
      || miembro?.puedeAdministrar === true;
  }

  get grupos(): FamiliaCompartidaGrupo[] {
    const map = new Map<string, FamiliaCompartidaGrupo>();

    for (const compartido of this.alumno?.compartidos ?? []) {
      const key = compartido.idfamiliaDestino
        ? `id:${compartido.idfamiliaDestino}`
        : `nombre:${compartido.familiaDestino ?? 'sin-familia'}`;
      const existing = map.get(key);

      if (existing) {
        existing.integrantes.push(compartido);
        continue;
      }

      map.set(key, {
        key,
        idfamiliaDestino: compartido.idfamiliaDestino ?? null,
        familiaDestino: compartido.familiaDestino || 'Familia receptora',
        integrantes: [compartido],
      });
    }

    return Array.from(map.values()).sort((a, b) => a.familiaDestino.localeCompare(b.familiaDestino));
  }

  cargar(event?: { target?: { complete?: () => void } }): void {
    if (!this.idmatricula || !this.idorg) {
      this.loading = false;
      event?.target?.complete?.();
      return;
    }

    this.loading = true;
    this.redFamiliarService.consultarMiRed(this.idorg).subscribe({
      next: (rows) => {
        this.rows = rows;
        this.alumno = this.resolverAlumno(rows);
        this.loading = false;
        event?.target?.complete?.();
      },
      error: async (error) => {
        this.loading = false;
        event?.target?.complete?.();
        await this.showToast(this.errorMessage(error, 'No fue posible consultar las personas autorizadas.'), 'danger');
      },
    });
  }

  volver(): void {
    this.navController.back();
  }

  permisoLabel(compartido: AlumnoCompartido): string {
    const tipo = (compartido.tipoRelacion ?? '').toUpperCase();
    return tipo === 'FAMILIAR_COMPARTIDO_PERMANENTE' || tipo === 'COMPARTIDO'
      ? 'Permanente'
      : 'Provisional';
  }

  async revocarPersona(compartido: AlumnoCompartido): Promise<void> {
    const confirmed = await this.confirmar(
      'Revocar persona',
      `${compartido.familiarDestino || 'La persona seleccionada'} dejara de poder recoger a ${this.alumno?.alumno || 'este alumno'}.`
    );

    if (!confirmed) {
      return;
    }

    this.revocando.add(compartido.idalumnoautorizacion);
    this.redFamiliarService.cambiarEstadoAlumno(compartido.idalumnoautorizacion, this.idorg, false).subscribe({
      next: async () => {
        this.revocando.delete(compartido.idalumnoautorizacion);
        this.quitarAutorizacionesLocales(new Set([compartido.idalumnoautorizacion]));
        await this.showToast('Autorizacion individual revocada.', 'success');
      },
      error: async (error) => {
        this.revocando.delete(compartido.idalumnoautorizacion);
        await this.showToast(this.errorMessage(error, 'No fue posible revocar la autorizacion.'), 'danger');
      },
    });
  }

  async revocarFamilia(grupo: FamiliaCompartidaGrupo): Promise<void> {
    const idfamiliaOrigen = this.idfamiliaOrigen;
    const idfamiliaDestino = grupo.idfamiliaDestino;
    if (!idfamiliaOrigen || !idfamiliaDestino) {
      await this.showToast('No fue posible identificar ambas familias.', 'danger');
      return;
    }

    const confirmed = await this.confirmar(
      'Revocar familia',
      `Las ${grupo.integrantes.length} personas de ${grupo.familiaDestino} dejaran de poder recoger a ${this.alumno?.alumno || 'este alumno'}.`
    );

    if (!confirmed) {
      return;
    }

    this.revocandoFamilias.add(idfamiliaDestino);
    this.redFamiliarService.revocarAlumnoCompartidoFamilia(
      this.idmatricula,
      idfamiliaDestino,
      this.idorg,
      idfamiliaOrigen
    ).subscribe({
      next: async (resultado) => {
        this.revocandoFamilias.delete(idfamiliaDestino);
        this.quitarAutorizacionesLocales(
          new Set(grupo.integrantes.map((item) => item.idalumnoautorizacion))
        );
        await this.showToast(`${resultado.autorizacionesRevocadas} autorizaciones revocadas.`, 'success');
      },
      error: async (error) => {
        this.revocandoFamilias.delete(idfamiliaDestino);
        await this.showToast(this.errorMessage(error, 'No fue posible revocar a la familia.'), 'danger');
      },
    });
  }

  private resolverAlumno(rows: RedFamiliarRow[]): AlumnoFamiliar | null {
    const row = rows.find((item) => item.idmatricula === this.idmatricula && this.esNucleo(item))
      ?? rows.find((item) => item.idmatricula === this.idmatricula);

    if (!row?.idmatricula || !row.alumno) {
      return null;
    }

    return {
      idalumnoautorizacion: row.idalumnoautorizacion ?? 0,
      idmatricula: row.idmatricula,
      matricula: row.matricula,
      gradoGrupo: row.gradoGrupo,
      alumno: row.alumno,
      tipoRelacion: row.tipoRelacion,
      tipoRelacionDescripcion: row.tipoRelacionDescripcion,
      puedeRecoger: row.puedeRecoger,
      compartidos: row.compartidos ?? [],
    };
  }

  private esNucleo(row: RedFamiliarRow): boolean {
    return (row.tipoRelacion ?? '').toUpperCase() === 'FAMILIA_NUCLEO';
  }

  private quitarAutorizacionesLocales(ids: Set<number>): void {
    if (!this.alumno) {
      return;
    }

    this.alumno = {
      ...this.alumno,
      compartidos: (this.alumno.compartidos ?? []).filter((item) => !ids.has(item.idalumnoautorizacion)),
    };
  }

  private async confirmar(header: string, message: string): Promise<boolean> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Revocar', role: 'destructive' },
      ],
    });
    await alert.present();
    const result = await alert.onDidDismiss();
    return result.role === 'destructive';
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({ message, color, duration: 2600, position: 'bottom' });
    await toast.present();
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    const apiMessage = (error as { error?: { message?: string } })?.error?.message;
    return apiMessage || fallback;
  }
}
