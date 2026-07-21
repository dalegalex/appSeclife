import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Subscription, firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { CarruselAlumnoEntrega, CarruselPaquete, CarruselSesion } from '../../models/carrusel.model';
import { CarruselService } from '../../services/carrusel.service';

@Component({
  selector: 'app-carrusel-visor',
  templateUrl: './carrusel-visor.page.html',
  styleUrls: ['./carrusel-visor.page.scss'],
  standalone: false,
})
export class CarruselVisorPage implements OnDestroy {
  carruseles: CarruselSesion[] = [];
  sesion: CarruselSesion | null = null;
  bitacora: CarruselPaquete[] = [];
  loading = false;
  connecting = false;
  private subscriptions = new Subscription();
  private refrescoTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly carruselService: CarruselService,
    private readonly authService: AuthService,
    private readonly toastController: ToastController,
    private readonly cdRef: ChangeDetectorRef
  ) {
    this.subscriptions.add(this.carruselService.aviso$.subscribe(() => void this.refrescarBitacoraSilencioso()));
    this.subscriptions.add(this.carruselService.entrega$.subscribe(() => void this.refrescarBitacoraSilencioso()));
    this.subscriptions.add(this.carruselService.punto$.subscribe(() => void this.cargarCarruselesActivos(false)));
    this.subscriptions.add(this.carruselService.puntoDesconectado$.subscribe(() => void this.cargarCarruselesActivos(false)));
    this.subscriptions.add(this.carruselService.cierre$.subscribe(() => void this.cargarCarruselesActivos(false)));
  }

  get idorg(): number {
    return this.authService.getCurrentUser()?.idorg ?? 0;
  }

  get paquetesPendientes(): number {
    return this.bitacora.filter((paquete) => (paquete.alumnos ?? []).some((alumno) => this.alumnoPendiente(alumno))).length;
  }

  get alumnosPendientes(): number {
    return this.bitacora.reduce((total, paquete) => total + (paquete.alumnos ?? []).filter((alumno) => this.alumnoPendiente(alumno)).length, 0);
  }

  get alumnosEntregados(): number {
    return this.bitacora.reduce((total, paquete) => total + (paquete.alumnos ?? []).filter((alumno) => alumno.estatus === 'ENTREGADO').length, 0);
  }

  ionViewWillEnter(): void {
    void this.cargarCarruselesActivos(true);
  }

  async cargarCarruselesActivos(showLoading = true): Promise<void> {
    if (!this.idorg) {
      await this.showToast('No se encontro la organizacion del usuario.', 'danger');
      return;
    }

    if (showLoading) {
      this.loading = true;
    }

    try {
      this.carruseles = (await firstValueFrom(this.carruselService.listarSesiones(this.idorg)))
        .filter((sesion) => sesion.estatus === 'ABIERTA')
        .sort((a, b) => (a.nombrePuntoEntrega ?? '').localeCompare(b.nombrePuntoEntrega ?? '', 'es'));

      if (this.sesion && !this.carruseles.some((sesion) => sesion.idcarruselsesion === this.sesion?.idcarruselsesion)) {
        await this.salirDelCarrusel(false);
      }
    } catch (error: any) {
      await this.showToast(error?.error?.message || error?.message || 'No fue posible consultar carruseles activos.', 'danger');
    } finally {
      if (showLoading) {
        this.loading = false;
      }
      this.cdRef.detectChanges();
    }
  }

  async seleccionarCarrusel(sesion: CarruselSesion): Promise<void> {
    if (this.sesion?.idcarruselsesion === sesion.idcarruselsesion) {
      await this.refrescarBitacora();
      return;
    }

    this.connecting = true;
    try {
      await this.carruselService.conectar(this.idorg, sesion.idcarruselsesion);
      this.sesion = sesion;
      await this.refrescarBitacoraSilencioso();
      this.iniciarRefresco();
      await this.showToast('Visor conectado al carrusel.', 'success');
    } catch (error: any) {
      await this.showToast(error?.error?.message || error?.message || 'No fue posible conectar el visor.', 'danger');
    } finally {
      this.connecting = false;
      this.cdRef.detectChanges();
    }
  }

  async refrescarBitacora(): Promise<void> {
    if (!this.sesion) {
      await this.cargarCarruselesActivos(true);
      return;
    }

    this.loading = true;
    try {
      this.bitacora = this.ordenarBitacoraDescendente(
        await firstValueFrom(this.carruselService.consultarBitacora(this.sesion.idcarruselsesion, this.idorg))
      );
      await this.cargarCarruselesActivos(false);
    } catch (error: any) {
      await this.showToast(error?.error?.message || error?.message || 'No fue posible consultar la bitacora.', 'danger');
    } finally {
      this.loading = false;
      this.cdRef.detectChanges();
    }
  }

  async salirDelCarrusel(showToast = true): Promise<void> {
    this.detenerRefresco();
    this.sesion = null;
    this.bitacora = [];
    await this.carruselService.desconectar();
    if (showToast) {
      await this.showToast('Visor desconectado.', 'medium');
    }
    this.cdRef.detectChanges();
  }

  alumnoPendiente(alumno: CarruselAlumnoEntrega): boolean {
    return alumno.estatus === 'PENDIENTE' || alumno.estatus === 'LLAMADO';
  }

  estadoColor(estatus?: string | null): string {
    if (estatus === 'ENTREGADO') return 'success';
    if (estatus === 'CANCELADO') return 'danger';
    if (estatus === 'EN_PREPARACION') return 'warning';
    if (estatus === 'LLAMADO') return 'tertiary';
    return 'primary';
  }

  islaNumero(paquete: CarruselPaquete): string {
    const match = `${paquete.isla ?? ''}`.match(/\d+/);
    return match?.[0] ?? '-';
  }

  entregaLabel(paquete: CarruselPaquete): string {
    if (paquete.entregaPeatonal) return 'Peatonal';
    if (paquete.otroAuto) return 'Otro auto';
    if (paquete.placas) {
      return `${paquete.placas}${paquete.autoDescripcion ? ' | ' + paquete.autoDescripcion : ''}`;
    }
    return 'Sin auto';
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.detenerRefresco();
    void this.carruselService.desconectar();
  }

  private async refrescarBitacoraSilencioso(): Promise<void> {
    if (!this.sesion) {
      return;
    }

    try {
      this.bitacora = this.ordenarBitacoraDescendente(
        await firstValueFrom(this.carruselService.consultarBitacora(this.sesion.idcarruselsesion, this.idorg))
      );
      this.cdRef.detectChanges();
    } catch {
      // El visor debe seguir conectado aunque una lectura de refresco falle.
    }
  }

  private iniciarRefresco(): void {
    this.detenerRefresco();
    this.refrescoTimer = setInterval(() => {
      void this.refrescarBitacoraSilencioso();
    }, 5000);
  }

  private detenerRefresco(): void {
    if (this.refrescoTimer) {
      clearInterval(this.refrescoTimer);
      this.refrescoTimer = null;
    }
  }

  private ordenarBitacoraDescendente(paquetes: CarruselPaquete[]): CarruselPaquete[] {
    return [...paquetes].sort((a, b) => {
      const posicionA = a.posicionCola ?? a.idcarrusellectura ?? 0;
      const posicionB = b.posicionCola ?? b.idcarrusellectura ?? 0;
      return posicionB - posicionA;
    });
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 2200, color, position: 'bottom' });
    await toast.present();
  }
}
