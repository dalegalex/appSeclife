import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import {
  PadreAlumnoUsuario,
  PadreDashboard,
  PadreRutaAlumno,
  TransporteParada,
  TransporteGpsPosicion,
  TransporteRutaDisponibleSolicitud,
  TransporteSolicitud,
  TransporteSolicitudTipo,
} from '../../models/padre-ruta.model';
import { PadreRutasService } from '../../services/padre-rutas.service';
import { formatClockAmPm, formatMexicoTime, resolveDiaSemanaMexico } from '../../services/transporte-date.util';

declare const google: any;

@Component({
  selector: 'app-padre-dashboard',
  templateUrl: './padre-dashboard.page.html',
  styleUrls: ['./padre-dashboard.page.scss'],
  standalone: false,
})
export class PadreDashboardPage implements OnInit, OnDestroy {
  @ViewChild('parentMap') parentMap?: ElementRef<HTMLDivElement>;

  dashboard?: PadreDashboard;
  idusr = 0;
  idmatriculaActiva?: number;
  vistaActiva: 'estado' | 'mapa' = 'estado';
  cargando = true;
  mensajeEstado = '';
  ultimaActualizacion?: Date;
  solicitudAbierta = false;
  solicitudAlumno?: PadreRutaAlumno;
  solicitudTipo: TransporteSolicitudTipo = 'CAMBIO_RUTA';
  solicitudFecha = '';
  solicitudSentido: 'ENTRADA' | 'SALIDA' = 'ENTRADA';
  solicitudRutaDestinoId?: number;
  solicitudParadaDestinoId?: number;
  solicitudComentarios = '';
  solicitudError = '';
  solicitudCargandoRutas = false;
  solicitudCargandoParadas = false;
  solicitudGuardando = false;
  rutasDisponibles: TransporteRutaDisponibleSolicitud[] = [];
  paradasDestino: TransporteParada[] = [];
  solicitudesPadre: TransporteSolicitud[] = [];
  solicitudesCargando = false;
  mapaExpandido = false;

  private refreshIntervalId?: number;
  private solicitudesRefreshIntervalId?: number;
  private mapRefreshIntervalId?: number;
  private map?: any;
  private directionsService?: any;
  private directionsRenderer?: any;
  private busMarker?: any;
  private stopMarker?: any;
  private routeMarkers: any[] = [];
  private mapElement?: HTMLDivElement;
  private renderedRouteKey = '';
  private renderedMarkerKey = '';
  private userAdjustedMap = false;

  constructor(
    private readonly padreRutasService: PadreRutasService,
    private readonly alertController: AlertController,
    private readonly toastController: ToastController
  ) {}

  ngOnInit(): void {
    this.idusr = this.padreRutasService.getIdusrDefault();
    this.cargarDashboard();

    this.refreshIntervalId = window.setInterval(() => {
      this.cargarDashboard(false, false);
    }, 30000);

    this.solicitudesRefreshIntervalId = window.setInterval(() => {
      this.cargarSolicitudesPadre(false);
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshIntervalId) {
      window.clearInterval(this.refreshIntervalId);
    }

    if (this.solicitudesRefreshIntervalId) {
      window.clearInterval(this.solicitudesRefreshIntervalId);
    }

    this.detenerRefrescoMapa();
  }

  cargarDashboard(showLoading = true, refreshSolicitudes = true): void {
    if (!Number.isFinite(this.idusr) || this.idusr <= 0) {
      this.mensajeEstado = 'No fue posible identificar al padre de familia.';
      this.cargando = false;
      return;
    }

    this.cargando = showLoading;
    this.mensajeEstado = '';

    this.padreRutasService.consultarDashboard(this.idusr).subscribe((dashboard) => {
      this.dashboard = dashboard;
      this.syncAlumnoActivo();
      this.cargando = false;
      this.ultimaActualizacion = new Date();
      this.mensajeEstado = dashboard.alumnosPadre.length === 0
        ? 'No se encontraron alumnos vinculados a este usuario.'
        : '';
      if (refreshSolicitudes) {
        this.cargarSolicitudesPadre();
      }
      this.programarRenderMapa();
    });
  }

  refrescarManual(): void {
    this.cargarDashboard();
    this.presentToast('Consulta actualizada.');
  }

  abrirSolicitud(item: PadreRutaAlumno): void {
    this.solicitudAlumno = item;
    this.solicitudTipo = 'CAMBIO_RUTA';
    this.solicitudFecha = this.dashboard?.fecha || this.toSqlDate(new Date());
    this.solicitudSentido = item.sentido;
    this.solicitudRutaDestinoId = undefined;
    this.solicitudParadaDestinoId = undefined;
    this.solicitudComentarios = '';
    this.solicitudError = '';
    this.rutasDisponibles = [];
    this.paradasDestino = [];
    this.solicitudAbierta = true;
    this.cargarRutasDisponibles();
  }

  cerrarSolicitud(): void {
    if (this.solicitudGuardando) {
      return;
    }

    this.solicitudAbierta = false;
  }

  onSolicitudTipoChange(value: TransporteSolicitudTipo): void {
    this.solicitudTipo = value;
    this.solicitudError = '';
    this.solicitudRutaDestinoId = undefined;
    this.solicitudParadaDestinoId = undefined;
    this.paradasDestino = [];

    if (value === 'CAMBIO_RUTA') {
      this.cargarRutasDisponibles();
    }
  }

  onSolicitudContextChange(): void {
    this.solicitudRutaDestinoId = undefined;
    this.solicitudParadaDestinoId = undefined;
    this.paradasDestino = [];
    this.solicitudError = '';

    if (this.solicitudTipo === 'CAMBIO_RUTA') {
      this.cargarRutasDisponibles();
    }
  }

  seleccionarRutaDestino(value: number | string): void {
    const idruta = Number(value);
    this.solicitudRutaDestinoId = Number.isFinite(idruta) && idruta > 0 ? idruta : undefined;
    this.solicitudParadaDestinoId = undefined;
    this.paradasDestino = [];

    if (!this.solicitudRutaDestinoId) {
      return;
    }

    this.solicitudCargandoParadas = true;
    this.padreRutasService.consultarRutaDetalle(this.solicitudRutaDestinoId).subscribe({
      next: (ruta) => {
        this.paradasDestino = (ruta.paradas ?? [])
          .filter((parada) => parada.sitactivo !== false)
          .sort((a, b) => a.orden - b.orden);
        this.solicitudParadaDestinoId = this.paradasDestino[0]?.idrutaparada;
        this.solicitudCargandoParadas = false;
      },
      error: (error) => {
        this.solicitudCargandoParadas = false;
        this.solicitudError = this.resolveErrorMessage(error, 'No fue posible consultar las paradas de la ruta.');
      },
    });
  }

  enviarSolicitud(): void {
    const item = this.solicitudAlumno;
    const idorg = this.padreRutasService.getIdorgDefault();

    if (!item || !idorg) {
      this.solicitudError = 'No fue posible identificar la organizacion del usuario.';
      return;
    }

    if (!this.solicitudFecha) {
      this.solicitudError = 'Selecciona la fecha del servicio.';
      return;
    }

    if (this.solicitudTipo === 'CAMBIO_RUTA' && (!this.solicitudRutaDestinoId || !this.solicitudParadaDestinoId)) {
      this.solicitudError = 'Selecciona la ruta y parada destino.';
      return;
    }

    if (!this.isRutaOrigenDisponibleEnFecha(item, this.solicitudFecha)) {
      this.solicitudError = 'El alumno no tiene asignada esta ruta para la fecha seleccionada.';
      return;
    }

    this.solicitudGuardando = true;
    this.solicitudError = '';

    this.padreRutasService.crearSolicitudTransporte({
      idorg,
      idmatricula: item.idmatricula,
      fecha: this.solicitudFecha,
      sentido: this.solicitudSentido,
      tipoSolicitud: this.solicitudTipo,
      idrutaOrigen: item.idruta,
      idrutaDestino: this.solicitudTipo === 'CAMBIO_RUTA' ? this.solicitudRutaDestinoId : null,
      idrutaparadaDestino: this.solicitudTipo === 'CAMBIO_RUTA' ? this.solicitudParadaDestinoId : null,
      motivo: this.solicitudTipo === 'CAMBIO_RUTA'
        ? 'Solicitud de cambio temporal de ruta'
        : 'Solicitud para no tomar transporte',
      comentarios: this.solicitudComentarios || null,
    }).subscribe({
      next: () => {
        this.solicitudGuardando = false;
        this.solicitudAbierta = false;
        this.presentToast('Solicitud enviada al Colegio.');
        this.cargarDashboard(false, false);
        this.cargarSolicitudesPadre();
      },
      error: (error) => {
        this.solicitudGuardando = false;
        this.solicitudError = this.resolveErrorMessage(error, 'No fue posible registrar la solicitud.');
      },
    });
  }

  puedeCancelarSolicitud(solicitud: TransporteSolicitud): boolean {
    return solicitud.estatus === 'SOLICITADA';
  }

  async confirmarCancelarSolicitud(solicitud: TransporteSolicitud): Promise<void> {
    if (!this.puedeCancelarSolicitud(solicitud)) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Cancelar solicitud',
      message: 'La solicitud quedara cancelada y ya no sera revisada por el Colegio.',
      buttons: [
        {
          text: 'Conservar',
          role: 'cancel',
        },
        {
          text: 'Cancelar solicitud',
          role: 'destructive',
          handler: () => this.cancelarSolicitud(solicitud),
        },
      ],
    });

    await alert.present();
  }

  cancelarSolicitud(solicitud: TransporteSolicitud): void {
    this.padreRutasService.cancelarSolicitudTransporte(
      solicitud.idsolicitudtransporte,
      'Solicitud cancelada por el padre de familia'
    ).subscribe({
      next: () => {
        this.presentToast('Solicitud cancelada.');
        this.cargarSolicitudesPadre();
        this.cargarDashboard(false, false);
      },
      error: (error) => {
        this.presentToast(this.resolveErrorMessage(error, 'No fue posible cancelar la solicitud.'));
      },
    });
  }

  seleccionarAlumno(idmatricula: number | string): void {
    this.idmatriculaActiva = Number(idmatricula);
    this.cargarSolicitudesPadre();
    this.resetMapa();
    if (this.vistaActiva === 'mapa') {
      this.cargarDashboard(false, false);
      this.programarRenderMapa();
    }
  }

  activarVista(vista: 'estado' | 'mapa'): void {
    this.vistaActiva = vista;

    if (vista === 'mapa') {
      this.cargarDashboard(false, false);
      this.iniciarRefrescoMapa();
      this.programarRenderMapa();
      return;
    }

    this.mapaExpandido = false;
    this.detenerRefrescoMapa();
  }

  alternarMapaExpandido(): void {
    this.mapaExpandido = !this.mapaExpandido;
    this.userAdjustedMap = false;
    this.programarRenderMapa(this.mapaExpandido ? 180 : 80);
  }

  get padreNombre(): string {
    const padre = this.dashboard?.alumnosPadre?.[0];
    if (!padre) {
      return 'Padre de familia';
    }

    const nombre = `${padre.usrNombre || ''} ${padre.usrApellidos || ''}`.trim();
    return nombre || padre.usr || 'Padre de familia';
  }

  get alumnosVisibles(): PadreRutaAlumno[] {
    const alumnos = this.dashboard?.alumnos ?? [];
    if (!this.idmatriculaActiva) {
      return alumnos;
    }

    return alumnos.filter((alumno) => alumno.idmatricula === this.idmatriculaActiva);
  }

  get alumnosSelector(): PadreAlumnoUsuario[] {
    const alumnos = this.dashboard?.alumnosPadre ?? [];
    const unique = new Map<number, PadreAlumnoUsuario>();

    alumnos.forEach((alumno) => {
      if (!unique.has(alumno.idmatricula)) {
        unique.set(alumno.idmatricula, alumno);
      }
    });

    return Array.from(unique.values());
  }

  get alumnoActivoSinRuta(): PadreAlumnoUsuario | null {
    if (!this.idmatriculaActiva || this.alumnosVisibles.length > 0) {
      return null;
    }

    return this.alumnosSelector.find((alumno) => alumno.idmatricula === this.idmatriculaActiva) ?? null;
  }

  get solicitudesAlumnoActivo(): TransporteSolicitud[] {
    const solicitudesVigentes = this.solicitudesPadre.filter((solicitud) => this.esSolicitudVigente(solicitud));

    if (!this.idmatriculaActiva) {
      return solicitudesVigentes;
    }

    return solicitudesVigentes.filter((solicitud) => solicitud.idmatricula === this.idmatriculaActiva);
  }

  trackByAlumnoSelector(_index: number, alumno: PadreAlumnoUsuario): number {
    return alumno.idmatricula;
  }

  trackByRutaAlumno(_index: number, item: PadreRutaAlumno): string {
    return [
      item.idmatricula,
      item.idruta,
      item.sentido,
      item.paradaLatitud ?? '',
      item.paradaLongitud ?? ''
    ].join('|');
  }

  trackBySolicitud(_index: number, solicitud: TransporteSolicitud): number {
    return solicitud.idsolicitudtransporte;
  }

  get rutaDestinoSeleccionada(): TransporteRutaDisponibleSolicitud | null {
    if (!this.solicitudRutaDestinoId) {
      return null;
    }

    return this.rutasDisponibles.find((ruta) => ruta.idruta === this.solicitudRutaDestinoId) ?? null;
  }

  resolveAlumnoNombre(alumno: PadreAlumnoUsuario): string {
    const nombre = `${alumno.alumnoNombre || ''} ${alumno.alumnoApellidos || ''}`.trim();
    return nombre || alumno.alumno || `Alumno ${alumno.idmatricula}`;
  }

  resolveAlumnoNombreCorto(alumno: PadreAlumnoUsuario): string {
    return alumno.alumnoNombre || alumno.alumno?.split(' ')[0] || `Alumno ${alumno.idmatricula}`;
  }

  abrirMapa(item: PadreRutaAlumno): void {
    const url = this.buildGoogleMapsDirectionsUrl(item);
    if (!url) {
      this.presentToast('Aun no hay coordenadas disponibles para esta ruta.');
      return;
    }

    window.open(url, '_blank');
  }

  estadoColor(item: PadreRutaAlumno): string {
    const colors: Record<PadreRutaAlumno['estado'], string> = {
      sin_recorrido: 'medium',
      esperando: 'warning',
      en_unidad: 'primary',
      entregado: 'success',
      ausente: 'medium',
      incidencia: 'danger',
    };

    return colors[item.estado];
  }

  esRecorridoActivo(item: PadreRutaAlumno): boolean {
    return item.recorrido?.estatus === 'EN_CURSO';
  }

  resolveFechaHora(value?: string | null): string {
    return formatMexicoTime(value);
  }

  resolveHoraProgramada(value?: string | null): string {
    if (!value) {
      return '';
    }

    const match = value.match(/^(\d{2}):(\d{2})/);
    return match ? formatClockAmPm(Number(match[1]), Number(match[2])) : value;
  }

  resolveHoraActualizacion(value?: Date | null): string {
    return formatMexicoTime(value);
  }

  resolveRutaDisponibleNombre(ruta: TransporteRutaDisponibleSolicitud): string {
    const nombre = ruta.descripcion || ruta.clave || `Ruta ${ruta.idruta}`;
    const hora = ruta.horaServicio ? ` | ${this.resolveHoraProgramada(ruta.horaServicio)}` : '';
    return `${nombre}${hora}`;
  }

  resolveCupoRuta(ruta: TransporteRutaDisponibleSolicitud): string {
    if (ruta.cupoMaximo === null || ruta.cupoMaximo === undefined) {
      return 'Cupo abierto';
    }

    return `${ruta.cupoDisponible ?? 0} de ${ruta.cupoMaximo} lugares disponibles`;
  }

  resolveRutaNoDisponibleMotivo(ruta: TransporteRutaDisponibleSolicitud): string {
    if (ruta.cupoMaximo !== null && ruta.cupoMaximo !== undefined && (ruta.cupoDisponible ?? 0) <= 0) {
      return 'sin cupo';
    }

    if (ruta.fechaLimiteSolicitud && new Date(ruta.fechaLimiteSolicitud).getTime() < Date.now()) {
      return 'fuera de horario';
    }

    return 'no disponible';
  }

  resolveFechaLimiteSolicitud(ruta: TransporteRutaDisponibleSolicitud): string {
    return formatMexicoTime(ruta.fechaLimiteSolicitud);
  }

  resolveSolicitudTipoLabel(tipo?: string | null): string {
    switch (tipo) {
      case 'CAMBIO_RUTA':
        return 'Cambio de ruta';
      case 'NO_TOMA_TRANSPORTE':
        return 'No toma transporte';
      case 'CAMBIO_PARADA':
        return 'Cambio de parada';
      default:
        return tipo || 'Solicitud';
    }
  }

  resolveSolicitudEstatusColor(estatus?: string | null): string {
    switch (estatus) {
      case 'AUTORIZADA':
        return 'success';
      case 'RECHAZADA':
        return 'danger';
      case 'CANCELADA':
        return 'medium';
      default:
        return 'warning';
    }
  }

  private resolveMapPoint(item: PadreRutaAlumno): string | null {
    if (item.gps?.latitud !== null && item.gps?.latitud !== undefined &&
      item.gps?.longitud !== null && item.gps?.longitud !== undefined) {
      return `${item.gps.latitud},${item.gps.longitud}`;
    }

    if (item.paradaLatitud !== null && item.paradaLatitud !== undefined &&
      item.paradaLongitud !== null && item.paradaLongitud !== undefined) {
      return `${item.paradaLatitud},${item.paradaLongitud}`;
    }

    return null;
  }

  private iniciarRefrescoMapa(): void {
    if (this.mapRefreshIntervalId) {
      return;
    }

    this.mapRefreshIntervalId = window.setInterval(() => {
      this.actualizarGpsMapaActivo();
    }, 5000);
  }

  private detenerRefrescoMapa(): void {
    if (this.mapRefreshIntervalId) {
      window.clearInterval(this.mapRefreshIntervalId);
      this.mapRefreshIntervalId = undefined;
    }
  }

  private actualizarGpsMapaActivo(): void {
    const item = this.alumnosVisibles[0];
    if (!item?.idruta) {
      return;
    }

    this.padreRutasService.consultarUltimaGps(item.idruta).subscribe((gps) => {
      if (!gps) {
        return;
      }

      this.actualizarGpsRuta(item.idruta, gps);
      this.ultimaActualizacion = new Date();
      this.programarRenderMapa();
    });
  }

  private actualizarGpsRuta(idruta: number, gps: TransporteGpsPosicion): void {
    const alumnos = this.dashboard?.alumnos ?? [];
    alumnos
      .filter((alumno) => alumno.idruta === idruta)
      .forEach((alumno) => {
        alumno.gps = gps;
        this.actualizarProximidadParada(alumno);
      });
  }

  private actualizarProximidadParada(alumno: PadreRutaAlumno): void {
    if (alumno.recorrido?.estatus === 'FINALIZADO') {
      alumno.aproximandose = false;
      alumno.rutaEstadoTexto = 'Ruta finalizada';
      return;
    }

    const aproximandose = this.isAproximandoseParada(alumno);
    alumno.aproximandose = aproximandose;

    if (!aproximandose) {
      if (alumno.rutaEstadoTexto === 'Dentro del radio de parada') {
        alumno.rutaEstadoTexto = alumno.recorrido?.estatus === 'EN_CURSO'
          ? 'Ruta en trayecto'
          : alumno.ultimoEvento
            ? 'Registro recibido hoy'
            : 'Ruta pendiente';
      }
      return;
    }

    alumno.rutaEstadoTexto = 'Dentro del radio de parada';

  }

  private isAproximandoseParada(alumno: PadreRutaAlumno): boolean {
    if (!alumno.gps?.latitud || !alumno.gps.longitud || !alumno.paradaLatitud || !alumno.paradaLongitud) {
      return false;
    }

    const radio = alumno.paradaRadioMetros ?? 80;
    return this.distanceMeters(
      alumno.gps.latitud,
      alumno.gps.longitud,
      alumno.paradaLatitud,
      alumno.paradaLongitud
    ) <= radio;
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

  private cargarRutasDisponibles(): void {
    const item = this.solicitudAlumno;
    const idorg = this.padreRutasService.getIdorgDefault();

    if (!item || !idorg || !this.solicitudFecha) {
      return;
    }

    this.solicitudCargandoRutas = true;
    this.rutasDisponibles = [];

    this.padreRutasService.listarRutasDisponiblesSolicitud({
      idorg,
      idmatricula: item.idmatricula,
      fecha: this.solicitudFecha,
      sentido: this.solicitudSentido,
    }).subscribe({
      next: (rutas) => {
        this.rutasDisponibles = rutas.filter((ruta) => ruta.idruta !== item.idruta);
        this.solicitudCargandoRutas = false;
      },
      error: (error) => {
        this.solicitudCargandoRutas = false;
        this.solicitudError = this.resolveErrorMessage(error, 'No fue posible consultar rutas disponibles.');
      },
    });
  }

  private cargarSolicitudesPadre(showSpinner = true): void {
    const idorg = this.padreRutasService.getIdorgDefault();
    if (!idorg || !this.idusr) {
      this.solicitudesPadre = [];
      return;
    }

    this.solicitudesCargando = showSpinner;
    this.padreRutasService.listarSolicitudesPadre({
      idorg,
      idusr: this.idusr,
      idmatricula: this.idmatriculaActiva || null,
    }).subscribe({
      next: (solicitudes) => {
        this.solicitudesPadre = solicitudes;
        this.solicitudesCargando = false;
      },
      error: () => {
        this.solicitudesPadre = [];
        this.solicitudesCargando = false;
      },
    });
  }

  private buildGoogleMapsDirectionsUrl(item: PadreRutaAlumno): string | null {
    const destination = this.resolveStopPoint(item);
    if (!destination) {
      return null;
    }

    const origin = this.resolveBusPoint(item) || this.resolveFirstRoutePoint(item) || destination;
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    url.searchParams.set('origin', origin);
    url.searchParams.set('destination', destination);

    const waypoints = this.resolveRouteWaypoints(item, destination);
    if (waypoints.length > 0) {
      url.searchParams.set('waypoints', waypoints.join('|'));
    }

    return url.toString();
  }

  private resolveBusPoint(item: PadreRutaAlumno): string | null {
    if (item.gps?.latitud !== null && item.gps?.latitud !== undefined &&
      item.gps?.longitud !== null && item.gps?.longitud !== undefined) {
      return `${item.gps.latitud},${item.gps.longitud}`;
    }

    return null;
  }

  private resolveStopPoint(item: PadreRutaAlumno): string | null {
    if (item.paradaLatitud !== null && item.paradaLatitud !== undefined &&
      item.paradaLongitud !== null && item.paradaLongitud !== undefined) {
      return `${item.paradaLatitud},${item.paradaLongitud}`;
    }

    return this.resolveFirstRoutePoint(item);
  }

  private resolveFirstRoutePoint(item: PadreRutaAlumno): string | null {
    const punto = item.rutaPuntos?.[0];
    return punto ? `${punto.latitud},${punto.longitud}` : null;
  }

  private resolveRouteWaypoints(item: PadreRutaAlumno, destination: string): string[] {
    const points = (item.rutaPuntos ?? [])
      .map((punto) => `${punto.latitud},${punto.longitud}`)
      .filter((point) => point !== destination);

    return points.slice(0, 8);
  }

  private syncAlumnoActivo(): void {
    const alumnos = this.alumnosSelector;
    if (alumnos.length === 0) {
      this.idmatriculaActiva = undefined;
      return;
    }

    const existeActivo = alumnos.some((alumno) => alumno.idmatricula === this.idmatriculaActiva);
    if (!existeActivo) {
      this.idmatriculaActiva = alumnos[0].idmatricula;
    }
  }

  private programarRenderMapa(delayMs = 80): void {
    if (this.vistaActiva !== 'mapa') {
      return;
    }

    window.setTimeout(() => this.renderMapaPadre(), delayMs);
  }

  private renderMapaPadre(): void {
    const item = this.alumnosVisibles[0];
    const mapElement = this.parentMap?.nativeElement;

    if (!item || !mapElement || typeof google === 'undefined' || !google.maps) {
      return;
    }

    const center = this.resolveLatLngLiteral(this.resolveBusPoint(item)) ||
      this.resolveLatLngLiteral(this.resolveStopPoint(item)) ||
      this.resolveLatLngLiteral(this.resolveFirstRoutePoint(item));

    if (!center) {
      return;
    }

    if (!this.map || this.mapElement !== mapElement) {
      this.resetMapa(false);
      this.mapElement = mapElement;
      this.map = new google.maps.Map(mapElement, {
        center,
        zoom: 15,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
      });
      this.directionsService = new google.maps.DirectionsService();
      this.directionsRenderer = new google.maps.DirectionsRenderer({
        map: this.map,
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: {
          strokeColor: '#0f766e',
          strokeOpacity: 0.9,
          strokeWeight: 5,
        },
      });
      this.map.addListener('dragstart', () => {
        this.userAdjustedMap = true;
      });
    } else {
      google.maps.event.trigger(this.map, 'resize');
    }

    this.pintarRutaPadre(item);
  }

  private pintarRutaPadre(item: PadreRutaAlumno): void {
    const busPoint = this.resolveLatLngLiteral(this.resolveBusPoint(item));
    const stopPoint = this.resolveLatLngLiteral(this.resolveStopPoint(item));
    const firstPoint = this.resolveLatLngLiteral(this.resolveFirstRoutePoint(item));
    const origin = busPoint || firstPoint || stopPoint;
    const routeKey = this.resolveRouteKey(item);
    const markerKey = `${routeKey}|bus:${busPoint?.lat ?? ''}:${busPoint?.lng ?? ''}`;

    this.pintarBus(busPoint);
    this.centrarMapaEnAutobus(busPoint);

    if (markerKey !== this.renderedMarkerKey) {
      this.renderedMarkerKey = markerKey;
      this.clearRouteMarkers();
      this.pintarParada(item, stopPoint);
      this.pintarPuntosRuta(item, busPoint);
    }

    if (routeKey === this.renderedRouteKey) {
      return;
    }

    this.renderedRouteKey = routeKey;

    if (!origin || !stopPoint || !this.directionsService || !this.directionsRenderer) {
      this.directionsRenderer?.set('directions', null);
      this.fitMapa(item, busPoint, stopPoint);
      return;
    }

    if (origin.lat === stopPoint.lat && origin.lng === stopPoint.lng) {
      this.directionsRenderer.set('directions', null);
      if (!this.userAdjustedMap) {
        this.map?.setCenter(stopPoint);
      }
      return;
    }

    const waypoints = (item.rutaPuntos ?? [])
      .map((punto) => ({ lat: punto.latitud, lng: punto.longitud }))
      .filter((point) =>
        !(point.lat === firstPoint?.lat && point.lng === firstPoint?.lng) &&
        !(point.lat === stopPoint.lat && point.lng === stopPoint.lng)
      )
      .slice(0, 8)
      .map((point) => ({ location: point, stopover: true }));

    this.directionsService.route({
      origin: firstPoint || origin,
      destination: stopPoint,
      waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: google.maps.TrafficModel.BEST_GUESS,
      },
    }).then((result: any) => {
      this.directionsRenderer.setDirections(result);
      this.fitMapa(item, busPoint, stopPoint);
    }).catch(() => {
      this.directionsRenderer.set('directions', null);
      this.fitMapa(item, busPoint, stopPoint);
    });
  }

  private pintarBus(point: { lat: number; lng: number } | null): void {
    if (!point || !this.map) {
      if (this.busMarker) {
        this.busMarker.setMap(null);
        this.busMarker = undefined;
      }
      return;
    }

    if (!this.busMarker) {
      this.busMarker = new google.maps.Marker({
        map: this.map,
        position: point,
        title: 'Autobus',
        icon: this.createBusMarkerIcon(),
        zIndex: 20,
      });
      return;
    }

    this.busMarker.setPosition(point);
    this.busMarker.setIcon(this.createBusMarkerIcon());
  }

  private centrarMapaEnAutobus(point: { lat: number; lng: number } | null): void {
    if (!point || !this.map) {
      return;
    }

    this.map.panTo(point);
  }

  private pintarParada(item: PadreRutaAlumno, point: { lat: number; lng: number } | null): void {
    if (!point || !this.map) {
      if (this.stopMarker) {
        this.stopMarker.setMap(null);
        this.stopMarker = undefined;
      }
      return;
    }

    const alreadyNumbered = (item.rutaPuntos ?? []).some((punto) =>
      this.isSamePoint(point, { lat: punto.latitud, lng: punto.longitud })
    );

    if (alreadyNumbered) {
      this.stopMarker?.setMap(null);
      this.stopMarker = undefined;
      return;
    }

    if (!this.stopMarker) {
      this.stopMarker = new google.maps.Marker({
        map: this.map,
        position: point,
        title: item.paradaNombre,
        label: 'P',
      });
      return;
    }

    this.stopMarker.setPosition(point);
    this.stopMarker.setTitle(item.paradaNombre);
  }

  private pintarPuntosRuta(item: PadreRutaAlumno, busPoint: { lat: number; lng: number } | null): void {
    if (!this.map) {
      return;
    }

    (item.rutaPuntos ?? []).forEach((punto) => {
      const routePoint = { lat: punto.latitud, lng: punto.longitud };
      if (busPoint && this.isSamePoint(routePoint, busPoint)) {
        return;
      }

      const marker = new google.maps.Marker({
        map: this.map,
        position: routePoint,
        title: punto.nombre,
        label: String(punto.orden),
        zIndex: 10,
      });
      this.routeMarkers.push(marker);
    });
  }

  private clearRouteMarkers(): void {
    this.routeMarkers.forEach((marker) => marker.setMap(null));
    this.routeMarkers = [];
  }

  private resolveLatLngLiteral(value: string | null): { lat: number; lng: number } | null {
    if (!value) {
      return null;
    }

    const [lat, lng] = value.split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return { lat, lng };
  }

  private fitMapa(
    item: PadreRutaAlumno,
    busPoint: { lat: number; lng: number } | null,
    stopPoint: { lat: number; lng: number } | null
  ): void {
    if (!this.map) {
      return;
    }

    if (this.mapaExpandido && busPoint && !this.userAdjustedMap) {
      this.map.setCenter(busPoint);
      this.map.setZoom(16);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    let count = 0;

    (item.rutaPuntos ?? []).forEach((punto) => {
      bounds.extend({ lat: punto.latitud, lng: punto.longitud });
      count += 1;
    });

    if (busPoint) {
      bounds.extend(busPoint);
      count += 1;
    }

    if (stopPoint) {
      bounds.extend(stopPoint);
      count += 1;
    }

    if (count > 1 && !this.userAdjustedMap) {
      this.map.fitBounds(bounds, 42);
      return;
    }

    if (count === 1 && !this.userAdjustedMap) {
      this.map.setZoom(16);
    }
  }

  private resetMapa(resetElement = true): void {
    this.clearRouteMarkers();
    this.busMarker?.setMap(null);
    this.busMarker = undefined;
    this.stopMarker?.setMap(null);
    this.stopMarker = undefined;
    this.directionsRenderer?.setMap(null);
    this.directionsRenderer = undefined;
    this.directionsService = undefined;
    this.map = undefined;
    this.renderedRouteKey = '';
    this.renderedMarkerKey = '';
    this.userAdjustedMap = false;
    if (resetElement) {
      this.mapElement = undefined;
    }
  }

  private createBusMarkerIcon(): any {
    const svg = `
      <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0f172a" flood-opacity="0.28"/>
        </filter>
        <g filter="url(#shadow)">
          <path d="M12 12c0-3 2.4-5.5 5.4-5.5h13.2c3 0 5.4 2.5 5.4 5.5v17.8c0 1.4-1.1 2.6-2.5 2.6h-1.1v3.1c0 1.1-.9 2-2 2h-1.8c-1.1 0-2-.9-2-2v-3.1h-9.2v3.1c0 1.1-.9 2-2 2h-1.8c-1.1 0-2-.9-2-2v-3.1h-1.1c-1.4 0-2.5-1.2-2.5-2.6V12z" fill="#facc15"/>
          <path d="M14.5 13.4h19v8.7h-19z" fill="#2563eb"/>
          <path d="M17.1 9.4h13.8c1 0 1.8.8 1.8 1.8v.5H15.3v-.5c0-1 .8-1.8 1.8-1.8z" fill="#172033"/>
          <circle cx="17.4" cy="28.1" r="2.3" fill="#172033"/>
          <circle cx="30.6" cy="28.1" r="2.3" fill="#172033"/>
          <path d="M18 39.6 24 46l6-6.4H18z" fill="#facc15"/>
        </g>
      </svg>`;

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: new google.maps.Size(48, 48),
      anchor: new google.maps.Point(24, 46),
    };
  }

  private resolveRouteKey(item: PadreRutaAlumno): string {
    return [
      item.idruta,
      item.idmatricula,
      item.sentido,
      item.paradaLatitud,
      item.paradaLongitud,
      (item.rutaPuntos ?? []).map((punto) => `${punto.orden}:${punto.latitud}:${punto.longitud}`).join(';')
    ].join('|');
  }

  private isSamePoint(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
  ): boolean {
    return Math.abs(a.lat - b.lat) < 0.00001 && Math.abs(a.lng - b.lng) < 0.00001;
  }

  private async presentToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 1600,
      position: 'bottom',
    });

    await toast.present();
  }

  private toSqlDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private esSolicitudVigente(solicitud: TransporteSolicitud): boolean {
    const fechaServicio = this.normalizarFechaServicio(solicitud.fechaServicio);
    if (!fechaServicio) {
      return true;
    }

    return fechaServicio >= this.toSqlDate(new Date());
  }

  private isRutaOrigenDisponibleEnFecha(item: PadreRutaAlumno, fecha: string): boolean {
    if ((item.tipoServicio ?? '').toUpperCase() !== 'REGULAR') {
      return true;
    }

    const dia = resolveDiaSemanaMexico(fecha);
    return item[dia] !== false;
  }

  private normalizarFechaServicio(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) {
      return match[1];
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return this.toSqlDate(parsed);
  }

  private resolveErrorMessage(error: unknown, fallback: string): string {
    const maybeError = error as { error?: { message?: string }; message?: string };
    return maybeError?.error?.message || maybeError?.message || fallback;
  }
}
