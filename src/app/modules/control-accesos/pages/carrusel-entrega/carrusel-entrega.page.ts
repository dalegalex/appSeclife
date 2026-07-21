import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Subscription, firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { CarruselAlumnoEntrega, CarruselPaquete, CarruselSesion } from '../../models/carrusel.model';
import { CarruselService } from '../../services/carrusel.service';

@Component({
  selector: 'app-carrusel-entrega',
  templateUrl: './carrusel-entrega.page.html',
  styleUrls: ['./carrusel-entrega.page.scss'],
  standalone: false,
})
export class CarruselEntregaPage implements OnDestroy {
  nombrePuntoEntrega = 'Punto de entrega';
  numeroIslas = 1;
  sesion: CarruselSesion | null = null;
  cola: CarruselPaquete[] = [];
  loading = false;
  saving = false;
  ultimoRefrescoCola: Date | null = null;
  ultimoErrorCola: string | null = null;
  private subscriptions = new Subscription();
  private refrescoSesionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly carruselService: CarruselService,
    private readonly authService: AuthService,
    private readonly toastController: ToastController,
    private readonly alertController: AlertController,
    private readonly cdRef: ChangeDetectorRef
  ) {
    this.subscriptions.add(this.carruselService.aviso$.subscribe(() => void this.refrescarColaSilencioso()));
    this.subscriptions.add(this.carruselService.entrega$.subscribe(() => void this.refrescarColaSilencioso()));
    this.subscriptions.add(this.carruselService.punto$.subscribe(() => void this.refrescarSesionSilencioso()));
    this.subscriptions.add(this.carruselService.puntoDesconectado$.subscribe(() => void this.refrescarSesionSilencioso()));
    this.nombrePuntoEntrega = this.getNombrePuntoGuardado();
  }

  get idorg(): number {
    return this.authService.getCurrentUser()?.idorg ?? 0;
  }

  get paquetesPendientes(): CarruselPaquete[] {
    return this.cola.filter((paquete) => paquete.estatus !== 'ENTREGADO');
  }

  get lectoresConectados(): number {
    return Number(this.sesion?.lectoresConectados ?? this.sesion?.lectores ?? 0);
  }

  ionViewWillEnter(): void {
    void this.recuperarSesionActiva(false);
  }

  async abrirSesion(): Promise<void> {
    if (!this.idorg) {
      await this.showToast('No se encontro la organizacion del usuario.', 'danger');
      return;
    }

    this.loading = true;
    try {
      const recuperada = await this.recuperarSesionActiva(false, false);
      if (recuperada) {
        await this.showToast('Carrusel recuperado. Se cargo la cola pendiente.', 'success');
        return;
      }

      const nombrePunto = this.nombrePuntoEntrega?.trim() || 'Punto de entrega';
      const sesion = await firstValueFrom(this.carruselService.abrirSesion({
        idorg: this.idorg,
        nombrePuntoEntrega: nombrePunto,
        numeroIslas: this.numeroIslas || 1,
        nombreDispositivo: this.nombreDispositivo(),
        dispositivoUid: this.dispositivoUid(),
      }));

      this.guardarNombrePunto(nombrePunto);
      this.sesion = sesion;
      await this.carruselService.conectar(this.idorg, sesion.idcarruselsesion);
      this.iniciarRefrescoSesion();
      await this.refrescarColaSilencioso();
      await this.refrescarSesionSilencioso();
      await this.showToast('Carrusel abierto. Listo para recibir avisos.', 'success');
    } catch (error: any) {
      await this.showToast(error?.error?.message || error?.message || 'No fue posible abrir el carrusel.', 'danger');
    } finally {
      this.loading = false;
      this.cdRef.detectChanges();
    }
  }

  async cerrarSesion(): Promise<void> {
    if (!this.sesion) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Cerrar carrusel',
      message: 'El punto de entrega dejara de recibir avisos y ya no aparecera como carrusel activo.',
      buttons: [
        { text: 'No', role: 'cancel' },
        {
          text: 'Cerrar',
          role: 'destructive',
          handler: () => {
            void this.ejecutarCierreSesion();
          },
        },
      ],
    });
    await alert.present();
  }

  async refrescarCola(): Promise<void> {
    if (!this.sesion) {
      return;
    }

    this.loading = true;
    try {
      this.cola = await firstValueFrom(this.carruselService.consultarCola(this.sesion.idcarruselsesion, this.idorg));
      this.ultimoRefrescoCola = new Date();
      this.ultimoErrorCola = null;
    } catch (error: any) {
      this.ultimoErrorCola = error?.error?.message || error?.message || 'No fue posible consultar la cola.';
      await this.showToast(error?.error?.message || error?.message || 'No fue posible consultar la cola.', 'danger');
    } finally {
      this.loading = false;
      this.cdRef.detectChanges();
    }
  }

  async confirmarPaquete(paquete: CarruselPaquete): Promise<void> {
    const alumnos = (paquete.alumnos ?? [])
      .filter((alumno) => this.alumnoPendiente(alumno))
      .map((alumno) => ({ idcarruselentregaalumno: alumno.idcarruselentregaalumno }));

    if (!alumnos.length) {
      await this.showToast('No hay alumnos pendientes en este paquete.', 'warning');
      return;
    }

    this.saving = true;
    try {
      await firstValueFrom(this.carruselService.confirmarEntrega(paquete.idcarrusellectura, {
        idorg: this.idorg,
        alumnos,
      }));
      await this.refrescarColaSilencioso();
      await this.showToast('Entrega registrada correctamente.', 'success');
    } catch (error: any) {
      await this.showToast(error?.error?.message || error?.message || 'No fue posible confirmar la entrega.', 'danger');
    } finally {
      this.saving = false;
      this.cdRef.detectChanges();
    }
  }

  async cancelarAlumno(alumno: CarruselAlumnoEntrega): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Cancelar alumno',
      message: `Se quitara a ${alumno.alumno} de este paquete de entrega.`,
      buttons: [
        { text: 'No', role: 'cancel' },
        {
          text: 'Cancelar alumno',
          role: 'destructive',
          handler: () => {
            void this.ejecutarCancelacionAlumno(alumno);
          },
        },
      ],
    });
    await alert.present();
  }

  alumnoPendiente(alumno: CarruselAlumnoEntrega): boolean {
    return alumno.estatus === 'PENDIENTE' || alumno.estatus === 'LLAMADO';
  }

  estadoColor(estatus?: string | null): string {
    if (estatus === 'ENTREGADO') return 'success';
    if (estatus === 'CANCELADO') return 'danger';
    if (estatus === 'EN_PREPARACION') return 'warning';
    return 'primary';
  }

  islaNumero(paquete: CarruselPaquete): string {
    const match = `${paquete.isla ?? ''}`.match(/\d+/);
    return match?.[0] ?? '-';
  }

  imageSrc(foto?: string | null): string | null {
    if (!foto) {
      return null;
    }

    return foto.startsWith('data:image') ? foto : `data:image/jpeg;base64,${foto}`;
  }

  async cargarFotoAlumno(alumno: CarruselAlumnoEntrega): Promise<void> {
    if (alumno.fotoLoaded && !alumno.foto) {
      await this.showToast('El alumno no cuenta con fotografia.', 'medium');
      return;
    }

    if (alumno.fotoLoaded || alumno.fotoLoading) {
      return;
    }

    alumno.fotoLoading = true;
    this.cdRef.detectChanges();

    try {
      const result = await firstValueFrom(this.carruselService.consultarFotoAlumno(alumno.idmatricula, this.idorg));
      alumno.foto = result.foto ?? null;
      alumno.fotoLoaded = true;

      if (!alumno.foto) {
        await this.showToast('El alumno no cuenta con fotografia.', 'medium');
      }
    } catch (error: any) {
      await this.showToast(error?.error?.message || error?.message || 'No fue posible cargar la fotografia.', 'danger');
    } finally {
      alumno.fotoLoading = false;
      this.cdRef.detectChanges();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.detenerRefrescoSesion();
    void this.carruselService.desconectar();
  }

  private async refrescarColaSilencioso(): Promise<void> {
    if (!this.sesion) {
      return;
    }

    try {
      this.cola = await firstValueFrom(this.carruselService.consultarCola(this.sesion.idcarruselsesion, this.idorg));
      this.ultimoRefrescoCola = new Date();
      this.ultimoErrorCola = null;
      this.cdRef.detectChanges();
    } catch (error: any) {
      this.ultimoErrorCola = error?.error?.message || error?.message || 'No fue posible consultar la cola.';
      this.cdRef.detectChanges();
    }
  }

  private async refrescarSesionSilencioso(): Promise<void> {
    if (!this.sesion || !this.idorg) {
      return;
    }

    try {
      const sesiones = await firstValueFrom(this.carruselService.listarSesiones(this.idorg));
      const actualizada = sesiones.find((sesion) => sesion.idcarruselsesion === this.sesion?.idcarruselsesion);
      if (actualizada) {
        this.sesion = { ...this.sesion, ...actualizada };
      }
      this.cdRef.detectChanges();
    } catch {
      // El indicador de conectados es auxiliar; no debe interrumpir la entrega.
    }
  }

  private async recuperarSesionActiva(showToast = true, manageLoading = true): Promise<boolean> {
    if (!this.idorg || this.sesion) {
      return false;
    }

    if (manageLoading) {
      this.loading = true;
    }

    try {
      const sesiones = await firstValueFrom(this.carruselService.listarSesiones(this.idorg));
      const uid = this.dispositivoUid();
      const idusrbt = this.authService.getCurrentUser()?.idusrbt ?? null;
      const activa = sesiones.find((sesion) =>
        sesion.estatus === 'ABIERTA'
        && Number(sesion.pendientes ?? 0) > 0
        && (
          (!!sesion.dispositivoEntregaUid && sesion.dispositivoEntregaUid === uid)
          || (!!idusrbt && Number(sesion.idusrbtEntrega ?? 0) === Number(idusrbt))
        )
      );

      if (!activa) {
        return false;
      }

      this.sesion = activa;
      this.numeroIslas = activa.numeroIslas || this.numeroIslas;
      this.nombrePuntoEntrega = activa.nombrePuntoEntrega?.trim() || this.nombrePuntoEntrega;
      this.guardarNombrePunto(this.nombrePuntoEntrega);
      await this.carruselService.conectar(this.idorg, activa.idcarruselsesion);
      this.iniciarRefrescoSesion();
      await this.refrescarColaSilencioso();
      await this.refrescarSesionSilencioso();

      if (showToast) {
        await this.showToast('Carrusel recuperado. Se cargo la cola pendiente.', 'success');
      }

      return true;
    } catch (error: any) {
      if (showToast) {
        await this.showToast(error?.error?.message || error?.message || 'No fue posible recuperar el carrusel activo.', 'danger');
      }
      return false;
    } finally {
      if (manageLoading) {
        this.loading = false;
        this.cdRef.detectChanges();
      }
    }
  }

  private iniciarRefrescoSesion(): void {
    this.detenerRefrescoSesion();
    this.refrescoSesionTimer = setInterval(() => {
      void this.refrescarSesionSilencioso();
      void this.refrescarColaSilencioso();
    }, 5000);
  }

  private detenerRefrescoSesion(): void {
    if (this.refrescoSesionTimer) {
      clearInterval(this.refrescoSesionTimer);
      this.refrescoSesionTimer = null;
    }
  }

  private async ejecutarCancelacionAlumno(alumno: CarruselAlumnoEntrega): Promise<void> {
    this.saving = true;
    try {
      await firstValueFrom(this.carruselService.cancelarAlumno(alumno.idcarruselentregaalumno, {
        idorg: this.idorg,
        comentarios: 'Cancelado desde punto de entrega',
      }));
      await this.refrescarColaSilencioso();
      await this.showToast('Alumno cancelado del paquete.', 'warning');
    } catch (error: any) {
      await this.showToast(error?.error?.message || error?.message || 'No fue posible cancelar al alumno.', 'danger');
    } finally {
      this.saving = false;
      this.cdRef.detectChanges();
    }
  }

  private dispositivoUid(): string {
    const key = 'seclife.control-accesos.device.uid';
    const legacyKeys = ['seclife.carrusel.device.uid', 'seclife.lectura-asistida.device.uid'];
    let uid = localStorage.getItem(key);
    if (!uid) {
      uid = legacyKeys.map((legacyKey) => localStorage.getItem(legacyKey)).find((value) => !!value) ?? null;
    }
    if (!uid) {
      uid = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    }
    localStorage.setItem(key, uid);
    legacyKeys.forEach((legacyKey) => localStorage.setItem(legacyKey, uid));
    return uid;
  }

  private nombreDispositivo(): string {
    return this.authService.getDisplayName() || 'Dispositivo carrusel';
  }

  private getNombrePuntoGuardado(): string {
    const value = localStorage.getItem(this.nombrePuntoStorageKey());
    return value?.trim() || 'Punto de entrega';
  }

  private guardarNombrePunto(nombrePunto: string): void {
    localStorage.setItem(this.nombrePuntoStorageKey(), nombrePunto);
  }

  private nombrePuntoStorageKey(): string {
    const idusrbt = this.authService.getCurrentUser()?.idusrbt ?? 'anon';
    return `seclife.carrusel.nombre-punto.${idusrbt}`;
  }

  private async ejecutarCierreSesion(): Promise<void> {
    if (!this.sesion) {
      return;
    }

    this.loading = true;
    try {
      await firstValueFrom(this.carruselService.cerrarSesion(this.sesion.idcarruselsesion, {
        idorg: this.idorg,
        comentarios: 'Carrusel cerrado desde app movil',
      }));
      await this.carruselService.desconectar();
      this.detenerRefrescoSesion();
      this.sesion = null;
      this.cola = [];
      this.nombrePuntoEntrega = this.getNombrePuntoGuardado();
      await this.showToast('Carrusel cerrado correctamente.', 'success');
    } catch (error: any) {
      await this.showToast(error?.error?.message || error?.message || 'No fue posible cerrar el carrusel.', 'danger');
    } finally {
      this.loading = false;
      this.cdRef.detectChanges();
    }
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({ message, duration: 2400, color, position: 'bottom' });
    await toast.present();
  }
}
