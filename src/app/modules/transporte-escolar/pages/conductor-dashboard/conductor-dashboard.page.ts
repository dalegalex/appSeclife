import { Component, OnDestroy, OnInit } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ConductorAlumno, ConductorParada, ConductorRuta, TransporteRecorrido } from '../../models/conductor-ruta.model';
import { ConductorRutasService } from '../../services/conductor-rutas.service';
import { currentMexicoMinutes, formatMexicoTime } from '../../services/transporte-date.util';
import { TransporteOfflineSyncService } from '../../services/transporte-offline-sync.service';
import { AuthService } from '../../../../core/auth/auth.service';

interface SeclifeBackgroundLocationPlugin {
  start(options: {
    apiUrl: string;
    token: string;
    idrecorrido: number;
    idruta: number;
    idunidad: number;
    origen: string;
    intervalMs: number;
  }): Promise<{ running: boolean }>;
  stop(): Promise<{ running: boolean }>;
  status(): Promise<{ running: boolean; batteryOptimized?: boolean; backgroundLocationGranted?: boolean }>;
  requestIgnoreBatteryOptimizations(): Promise<{ batteryOptimized: boolean }>;
  openAppLocationSettings(): Promise<{ opened: boolean }>;
}

const SeclifeBackgroundLocation = registerPlugin<SeclifeBackgroundLocationPlugin>('SeclifeBackgroundLocation');
const GPS_SYNC_INTERVAL_MS = 5000;

@Component({
  selector: 'app-conductor-dashboard',
  templateUrl: './conductor-dashboard.page.html',
  styleUrls: ['./conductor-dashboard.page.scss'],
  standalone: false,
})
export class ConductorDashboardPage implements OnInit, OnDestroy {
  rutas: ConductorRuta[] = [];
  rutaActiva?: ConductorRuta;
  recorridoIniciado = false;
  cargando = true;
  mensajeEstado = '';
  gpsActivo = false;
  gpsMensaje = 'GPS pendiente';
  vistaActiva: 'lista' | 'mapa' = 'lista';
  ultimaSincronizacion?: Date;
  ultimaUbicacion?: {
    latitud: number;
    longitud: number;
    fecha: Date;
  };
  fechaInicioRecorrido?: string | null;
  pendientesSincronizar = 0;

  private gpsIntervalId?: number;
  private gpsVisualIntervalId?: number;
  private pendingSubscription?: Subscription;
  private backgroundGpsActivo = false;

  constructor(
    private readonly rutasService: ConductorRutasService,
    private readonly offlineSyncService: TransporteOfflineSyncService,
    private readonly sanitizer: DomSanitizer,
    private readonly toastController: ToastController,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargando = true;
    this.mensajeEstado = '';
    this.pendingSubscription = this.offlineSyncService.pendingCount$.subscribe((count) => {
      this.pendientesSincronizar = count;
    });
    void this.sincronizarPendientes();

    this.rutasService.listarMisRutas().subscribe({
      next: (rutas) => {
        this.rutas = rutas;
        this.rutaActiva = rutas[0];
        this.cargando = false;
        this.mensajeEstado = rutas.length === 0 ? 'No hay rutas asignadas para este conductor.' : '';

        if (this.rutaActiva) {
          this.cargarRecorridoActual();
        }
      },
      error: (error: Error) => {
        this.rutas = [];
        this.rutaActiva = undefined;
        this.cargando = false;
        this.mensajeEstado = error.message || 'No fue posible consultar rutas del conductor.';
      }
    });
  }

  ngOnDestroy(): void {
    this.detenerGps();
    this.pendingSubscription?.unsubscribe();
  }

  iniciarRecorrido(): void {
    if (!this.rutaActiva) {
      return;
    }

    this.rutasService.iniciarRecorrido(this.rutaActiva).subscribe((response) => {
      if (!response.result?.idrecorrido || response.codeNumber === 0) {
        this.presentToast(response.message || 'No fue posible iniciar el recorrido.');
        return;
      }

      this.aplicarRecorrido(response.result);
      this.iniciarGps();
      this.presentToast('Recorrido iniciado. GPS activo.');
    });
  }

  async finalizarRecorrido(): Promise<void> {
    if (!this.rutaActiva?.idrecorrido) {
      this.presentToast('No hay recorrido en curso para finalizar.');
      return;
    }

    await this.sincronizarPendientes();

    if (this.offlineSyncService.hasPending()) {
      this.presentToast('Hay eventos pendientes por sincronizar. El recorrido se podra finalizar cuando regrese la conexion.');
      return;
    }

    if (this.alumnosPendientesRegistro > 0) {
      this.presentToast(`No se puede finalizar. Hay ${this.alumnosPendientesRegistro} alumno${this.alumnosPendientesRegistro === 1 ? '' : 's'} pendiente${this.alumnosPendientesRegistro === 1 ? '' : 's'} por registrar.`);
      return;
    }

    this.rutasService.finalizarRecorrido(this.rutaActiva.idrecorrido).subscribe((response) => {
      if (response.codeNumber === 0) {
        this.presentToast(response.message || 'No fue posible finalizar el recorrido.');
        return;
      }

      this.rutaActiva!.estatus = 'finalizada';
      this.rutaActiva!.idrecorrido = response.result?.idrecorrido ?? this.rutaActiva!.idrecorrido;
      this.recorridoIniciado = false;
      this.detenerGps();
      this.presentToast('Recorrido finalizado. GPS detenido.');
    });
  }

  registrarAlumno(alumno: ConductorAlumno): void {
    const tipoEvento = this.rutaActiva?.sentido === 'SALIDA' ? 'BAJA' : 'SUBE';
    this.registrarEvento(alumno, tipoEvento, 'Alumno registrado.');
  }

  marcarAusente(alumno: ConductorAlumno): void {
    this.registrarEvento(alumno, 'AUSENTE', 'Alumno marcado como ausente.');
  }

  reportarIncidencia(alumno: ConductorAlumno): void {
    this.registrarEvento(alumno, 'INCIDENCIA', 'Incidencia registrada.');
  }

  seleccionarRuta(idruta: number | string): void {
    const rutaSeleccionada = this.rutas.find((ruta) => ruta.idruta === Number(idruta));
    if (!rutaSeleccionada || rutaSeleccionada.idruta === this.rutaActiva?.idruta) {
      return;
    }

    if (this.recorridoIniciado) {
      this.presentToast('Finaliza el recorrido actual antes de cambiar de ruta.');
      return;
    }

    if (this.offlineSyncService.hasPending()) {
      this.presentToast('Sincroniza los pendientes antes de cambiar de ruta.');
      return;
    }

    this.detenerGps();
    this.rutaActiva = rutaSeleccionada;
    this.recorridoIniciado = false;
    this.vistaActiva = 'lista';
    this.gpsMensaje = 'GPS pendiente';
    this.ultimaSincronizacion = undefined;
    this.ultimaUbicacion = undefined;
    this.fechaInicioRecorrido = undefined;
    this.cargarRecorridoActual();
  }

  activarVista(vista: 'lista' | 'mapa'): void {
    this.vistaActiva = vista;
  }

  abrirGoogleMaps(): void {
    const url = this.buildGoogleMapsDirectionsUrl();
    if (!url) {
      this.presentToast('La ruta aun no tiene coordenadas para abrir el mapa.');
      return;
    }

    window.open(url, '_blank');
  }

  registrarParadaActual(): void {
    this.vistaActiva = 'lista';
  }

  private registrarEvento(
    alumno: ConductorAlumno,
    tipoEvento: 'SUBE' | 'BAJA' | 'AUSENTE' | 'INCIDENCIA',
    mensajeOk: string
  ): void {
    if (!this.rutaActiva?.idrecorrido) {
      this.presentToast('Primero inicia el recorrido para registrar alumnos.');
      return;
    }

    const item = this.offlineSyncService.enqueueAlumnoEvento({
      idrecorrido: this.rutaActiva.idrecorrido,
      alumno,
      tipoEvento,
      latitud: this.ultimaUbicacion?.latitud ?? null,
      longitud: this.ultimaUbicacion?.longitud ?? null
    });

    alumno.estado = 'pendiente_sync';
    alumno.ultimoEvento = tipoEvento;
    alumno.clientEventIdPendiente = item.clientEventId;

    void this.sincronizarPendientes(true, mensajeOk, item.clientEventId);
  }

  private async presentToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 1800,
      position: 'bottom',
    });

    await toast.present();
  }

  private iniciarGps(): void {
    if (this.gpsIntervalId || this.backgroundGpsActivo) {
      return;
    }

    this.gpsActivo = true;
    this.gpsMensaje = 'Solicitando ubicacion...';

    if (Capacitor.isNativePlatform()) {
      void this.iniciarGpsSegundoPlano();
      return;
    }

    this.enviarUbicacionActual();

    this.gpsIntervalId = window.setInterval(() => {
      this.enviarUbicacionActual();
    }, this.resolveGpsIntervalMs());
  }

  private detenerGps(): void {
    if (this.gpsIntervalId) {
      window.clearInterval(this.gpsIntervalId);
      this.gpsIntervalId = undefined;
    }

    if (this.gpsVisualIntervalId) {
      window.clearInterval(this.gpsVisualIntervalId);
      this.gpsVisualIntervalId = undefined;
    }

    if (this.backgroundGpsActivo) {
      void this.detenerGpsSegundoPlano();
    }

    this.gpsActivo = false;
    this.gpsMensaje = this.ultimaUbicacion ? 'GPS detenido' : 'GPS pendiente';
  }

  private async iniciarGpsSegundoPlano(): Promise<void> {
    const rutaActiva = this.rutaActiva;
    const token = this.authService.getToken();

    if (!rutaActiva?.idrecorrido) {
      this.gpsMensaje = 'Recorrido pendiente de iniciar';
      return;
    }

    if (!rutaActiva.idunidad) {
      this.gpsMensaje = 'Ruta sin unidad asignada';
      return;
    }

    if (!token) {
      this.gpsMensaje = 'Sesion requerida para GPS';
      return;
    }

    try {
      const segundoPlanoPermitido = await this.validarPermisoUbicacionSegundoPlano();
      if (!segundoPlanoPermitido) {
        return;
      }

      await this.solicitarExclusionOptimizacionBateria();
      await SeclifeBackgroundLocation.start({
        apiUrl: this.rutasService.getApiUrl(),
        token,
        idrecorrido: rutaActiva.idrecorrido,
        idruta: rutaActiva.idruta,
        idunidad: rutaActiva.idunidad,
        origen: this.esAsistenteRuta ? 'APP_ASIST_RUTA_BG' : 'APP_CONDUCTOR_BG',
        intervalMs: this.resolveGpsIntervalMs(),
      });

      this.backgroundGpsActivo = true;
      this.ultimaSincronizacion = new Date();
      this.gpsMensaje = `GPS activo en segundo plano ${this.formatTime(this.ultimaSincronizacion)}`;
      this.iniciarMonitorVisualGpsSegundoPlano();
    } catch (error) {
      this.backgroundGpsActivo = false;
      this.detenerMonitorVisualGpsSegundoPlano();
      this.gpsMensaje = 'No fue posible activar GPS en segundo plano';
      console.warn('No fue posible activar GPS en segundo plano.', error);
      this.enviarUbicacionActual();

      this.gpsIntervalId = window.setInterval(() => {
        this.enviarUbicacionActual();
      }, this.resolveGpsIntervalMs());
    }
  }

  private async validarPermisoUbicacionSegundoPlano(): Promise<boolean> {
    try {
      const status = await SeclifeBackgroundLocation.status();
      if (status.backgroundLocationGranted !== false) {
        return true;
      }

      this.gpsMensaje = 'Activa ubicacion "Permitir todo el tiempo" para GPS en segundo plano';
      await SeclifeBackgroundLocation.openAppLocationSettings();
      return false;
    } catch (error) {
      console.warn('No fue posible validar permiso de ubicacion en segundo plano.', error);
      return true;
    }
  }

  private async solicitarExclusionOptimizacionBateria(): Promise<void> {
    try {
      const status = await SeclifeBackgroundLocation.status();
      if (status.batteryOptimized) {
        await SeclifeBackgroundLocation.requestIgnoreBatteryOptimizations();
      }
    } catch (error) {
      console.warn('No fue posible validar optimizacion de bateria para GPS.', error);
    }
  }

  private async detenerGpsSegundoPlano(): Promise<void> {
    try {
      await SeclifeBackgroundLocation.stop();
    } catch (error) {
      console.warn('No fue posible detener GPS en segundo plano.', error);
    } finally {
      this.backgroundGpsActivo = false;
      this.detenerMonitorVisualGpsSegundoPlano();
    }
  }

  private iniciarMonitorVisualGpsSegundoPlano(): void {
    this.detenerMonitorVisualGpsSegundoPlano();
    this.actualizarUltimaUbicacionDesdeApi();

    this.gpsVisualIntervalId = window.setInterval(() => {
      this.actualizarUltimaUbicacionDesdeApi();
    }, this.resolveGpsIntervalMs());
  }

  private detenerMonitorVisualGpsSegundoPlano(): void {
    if (!this.gpsVisualIntervalId) {
      return;
    }

    window.clearInterval(this.gpsVisualIntervalId);
    this.gpsVisualIntervalId = undefined;
  }

  private actualizarUltimaUbicacionDesdeApi(): void {
    const idruta = this.rutaActiva?.idruta;
    if (!idruta || !this.backgroundGpsActivo) {
      return;
    }

    this.rutasService.consultarUltimaGps(idruta).subscribe((gps) => {
      if (!gps?.fechaHora) {
        return;
      }

      const fecha = new Date(gps.fechaHora);
      if (Number.isNaN(fecha.getTime())) {
        return;
      }

      this.ultimaSincronizacion = fecha;
      this.gpsMensaje = `GPS sincronizado ${this.formatTime(fecha)}`;

      if (gps.latitud !== null && gps.latitud !== undefined && gps.longitud !== null && gps.longitud !== undefined) {
        this.ultimaUbicacion = {
          latitud: gps.latitud,
          longitud: gps.longitud,
          fecha,
        };
      }
    });
  }

  private enviarUbicacionActual(): void {
    if (!this.rutaActiva?.idunidad) {
      this.gpsMensaje = 'Ruta sin unidad asignada';
      return;
    }

    if (!navigator.geolocation) {
      this.gpsMensaje = 'GPS no disponible en este dispositivo';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitud = position.coords.latitude;
        const longitud = position.coords.longitude;
        const precisionMetros = Number.isFinite(position.coords.accuracy)
          ? Math.round(position.coords.accuracy)
          : null;

        this.ultimaUbicacion = {
          latitud,
          longitud,
          fecha: new Date(),
        };

        const rutaActiva = this.rutaActiva;

        if (!rutaActiva?.idrecorrido) {
          this.gpsMensaje = 'Recorrido pendiente de iniciar';
          return;
        }

        if (!rutaActiva.idunidad) {
          this.gpsMensaje = 'Ruta sin unidad asignada';
          return;
        }

        const idunidad = rutaActiva.idunidad;
        const clientEventId = crypto.randomUUID();
        this.rutasService.registrarGps(
          rutaActiva.idrecorrido,
          rutaActiva.idruta,
          idunidad,
          latitud,
          longitud,
          clientEventId,
          undefined,
          precisionMetros
        ).subscribe({
          next: (response) => {
            if (response.codeNumber === 0) {
              this.offlineSyncService.enqueueGps({
                idrecorrido: rutaActiva.idrecorrido,
                idruta: rutaActiva.idruta,
                idunidad,
                latitud,
                longitud,
                precisionMetros
              });
              this.gpsMensaje = 'GPS pendiente de sincronizar';
              void this.sincronizarPendientes(false);
              return;
            }

            this.ultimaSincronizacion = new Date();
            this.gpsMensaje = `GPS sincronizado ${this.formatTime(this.ultimaSincronizacion)}`;
          },
          error: () => {
            this.offlineSyncService.enqueueGps({
              idrecorrido: rutaActiva.idrecorrido,
              idruta: rutaActiva.idruta,
              idunidad,
              latitud,
              longitud,
              precisionMetros
            });
            this.gpsMensaje = 'GPS pendiente de sincronizar';
            void this.sincronizarPendientes(false);
          },
        });
      },
      (error) => {
        this.gpsMensaje = this.resolveGpsError(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: this.resolveGpsIntervalMs(),
        timeout: Math.max(10000, this.resolveGpsIntervalMs() * 2),
      }
    );
  }

  private resolveGpsIntervalMs(): number {
    const segundos = Number(this.rutaActiva?.intervaloGpsSegundos ?? 0);
    return Math.max(5, Number.isFinite(segundos) && segundos > 0 ? segundos : GPS_SYNC_INTERVAL_MS / 1000) * 1000;
  }

  private cargarRecorridoActual(): void {
    if (!this.rutaActiva) {
      return;
    }

    this.rutasService.consultarRecorridoActual(this.rutaActiva.idruta).subscribe((response) => {
      if (response.result) {
        this.aplicarRecorrido(response.result);
      } else {
        this.recorridoIniciado = false;
        this.rutaActiva!.estatus = 'pendiente';
      }
    });
  }

  private aplicarRecorrido(recorrido: TransporteRecorrido): void {
    if (!this.rutaActiva) {
      return;
    }

    this.rutaActiva.idrecorrido = recorrido.idrecorrido;
    this.rutaActiva.estatus = recorrido.estatus === 'FINALIZADO' ? 'finalizada' : 'en_recorrido';
    this.recorridoIniciado = recorrido.estatus !== 'FINALIZADO';
    this.fechaInicioRecorrido = recorrido.fechaInicio ?? recorrido.fecha ?? null;
    this.rutasService.aplicarEventosRecorrido(this.rutaActiva, recorrido.eventos ?? []);

    if (this.recorridoIniciado) {
      this.iniciarGps();
    } else {
      this.detenerGps();
    }
  }

  private async sincronizarPendientes(
    showToast = false,
    successMessage?: string,
    trackedClientEventId?: string
  ): Promise<void> {
    const pendientesAntes = this.offlineSyncService.pendingCount();

    await this.offlineSyncService.syncPending();

    const pendientesDespues = this.offlineSyncService.pendingCount();
    const trackedEventSynced = trackedClientEventId
      ? !this.offlineSyncService.hasClientEvent(trackedClientEventId)
      : false;

    if (trackedEventSynced && this.rutaActiva?.idrecorrido) {
      this.cargarRecorridoActual();

      if (showToast && successMessage) {
        this.presentToast(successMessage);
      }
    }

    if (pendientesDespues === 0) {
      this.ultimaSincronizacion = new Date();
      this.gpsMensaje = this.gpsActivo
        ? `GPS sincronizado ${this.formatTime(this.ultimaSincronizacion)}`
        : this.gpsMensaje;

      if (this.rutaActiva?.idrecorrido) {
        this.cargarRecorridoActual();
      }

      if (!trackedEventSynced && showToast && successMessage) {
        this.presentToast(successMessage);
      }

      return;
    }

    if (!trackedEventSynced && showToast && pendientesDespues >= pendientesAntes) {
      this.presentToast('Evento aplicado localmente. Se sincronizara cuando regrese la conexion.');
    }
  }

  private resolveGpsError(error: GeolocationPositionError): string {
    if (error.code === error.PERMISSION_DENIED) {
      return 'Permiso de ubicacion denegado';
    }

    if (error.code === error.POSITION_UNAVAILABLE) {
      return 'Ubicacion no disponible';
    }

    if (error.code === error.TIMEOUT) {
      return 'Tiempo agotado al obtener GPS';
    }

    return 'No fue posible obtener GPS';
  }

  private formatTime(value: Date): string {
    return formatMexicoTime(value);
  }

  formatMexicoTime(value?: Date | null): string {
    return formatMexicoTime(value);
  }

  get accionPrincipal(): string {
    if (!this.rutaActiva || this.rutaActiva.estatus === 'finalizada') {
      return 'Recorrido finalizado';
    }

    return this.recorridoIniciado ? 'Finalizar recorrido' : 'Iniciar recorrido';
  }

  get esAsistenteRuta(): boolean {
    return this.authService.getCurrentProfileId() === 11;
  }

  get rolOperadorRuta(): string {
    return this.esAsistenteRuta ? 'Asistente del conductor' : 'Conductor';
  }

  get nombreOperadorRuta(): string {
    return this.authService.getDisplayName();
  }

  get diasRecorridoAbierto(): number {
    if (!this.recorridoIniciado || !this.fechaInicioRecorrido) {
      return 0;
    }

    const fechaInicio = new Date(this.fechaInicioRecorrido);
    if (Number.isNaN(fechaInicio.getTime())) {
      return 0;
    }

    const inicio = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), fechaInicio.getDate()).getTime();
    const hoy = new Date();
    const hoyDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
    return Math.max(0, Math.floor((hoyDia - inicio) / 86400000));
  }

  get alumnosRegistrados(): number {
    return this.rutaActiva?.paradas
      .flatMap((parada) => parada.alumnos)
      .filter((alumno) => alumno.estado === 'registrado').length ?? 0;
  }

  get totalAlumnos(): number {
    return this.rutaActiva?.paradas
      .flatMap((parada) => parada.alumnos).length ?? 0;
  }

  get alumnosPendientesRegistro(): number {
    return this.rutaActiva?.paradas
      .flatMap((parada) => parada.alumnos)
      .filter((alumno) => alumno.estado === 'pendiente').length ?? 0;
  }

  get siguienteParada(): ConductorParada | null {
    const paradas = this.rutaActiva?.paradas ?? [];
    return paradas.find((parada) =>
      parada.alumnos.length > 0 &&
      parada.alumnos.some((alumno) => alumno.estado === 'pendiente' || alumno.estado === 'pendiente_sync')
    ) ?? paradas.find((parada) => parada.alumnos.length > 0) ?? paradas[0] ?? null;
  }

  get mapaUrl(): SafeResourceUrl | null {
    const url = this.buildGoogleMapsEmbedUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  }

  get mapParadas(): ConductorParada[] {
    return (this.rutaActiva?.paradas ?? []).filter((parada) => this.hasCoordinates(parada));
  }

  get llegadaSiguienteParada(): boolean {
    const parada = this.siguienteParada;
    if (!parada || !this.ultimaUbicacion || !this.hasCoordinates(parada)) {
      return false;
    }

    const radio = parada.radioMetros ?? 80;
    return this.distanceMeters(
      this.ultimaUbicacion.latitud,
      this.ultimaUbicacion.longitud,
      parada.latitud!,
      parada.longitud!
    ) <= radio;
  }

  get estadoTiempoSiguienteParada(): string {
    const parada = this.siguienteParada;
    if (!parada?.horaProgramada || parada.horaProgramada === '--:--') {
      return 'Sin horario';
    }

    const [hours, minutes] = parada.horaProgramada.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return 'Sin horario';
    }

    const scheduledMinutes = (hours * 60) + minutes;
    const diffMinutes = currentMexicoMinutes() - scheduledMinutes;

    if (diffMinutes > 5) {
      return `${diffMinutes} min de retraso`;
    }

    if (diffMinutes < -5) {
      return `${Math.abs(diffMinutes)} min antes`;
    }

    return 'En tiempo';
  }

  private buildGoogleMapsEmbedUrl(): string | null {
    const parada = this.siguienteParada && this.hasCoordinates(this.siguienteParada)
      ? this.siguienteParada
      : this.mapParadas[0];

    if (!parada || !this.hasCoordinates(parada)) {
      return null;
    }

    const point = this.formatPoint(parada);
    return `https://maps.google.com/maps?q=${encodeURIComponent(point)}&z=16&output=embed`;
  }

  private buildGoogleMapsDirectionsUrl(): string | null {
    const paradas = this.mapParadas;
    if (paradas.length === 0) {
      return null;
    }

    const origin = this.ultimaUbicacion
      ? `${this.ultimaUbicacion.latitud},${this.ultimaUbicacion.longitud}`
      : this.formatPoint(paradas[0]);
    const destination = this.formatPoint(paradas[paradas.length - 1]);
    const waypoints = paradas.slice(0, -1).map((parada) => this.formatPoint(parada));

    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    url.searchParams.set('origin', origin);
    url.searchParams.set('destination', destination);
    if (waypoints.length > 0) {
      url.searchParams.set('waypoints', waypoints.join('|'));
    }

    return url.toString();
  }

  private formatPoint(parada: ConductorParada): string {
    return `${parada.latitud},${parada.longitud}`;
  }

  private hasCoordinates(parada: ConductorParada): boolean {
    return parada.latitud !== null &&
      parada.latitud !== undefined &&
      parada.longitud !== null &&
      parada.longitud !== undefined;
  }

  private distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const radius = 6371000;
    const toRad = (value: number) => value * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

    return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
