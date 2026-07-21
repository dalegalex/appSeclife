import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import {
  PadreDashboard,
  PadreAlumnoUsuario,
  PadreRutaAlumno,
  PadreRutaPunto,
  CrearSolicitudTransporteRequest,
  SpResponse,
  TransporteAlumnoRuta,
  TransporteEventoAlumno,
  TransporteGpsPosicion,
  TransporteParada,
  TransporteRecorrido,
  TransporteRutaDetalle,
  TransporteRutaDisponibleSolicitud,
  TransporteRutaListItem,
  TransporteSolicitud,
} from '../models/padre-ruta.model';
import { formatClockAmPm, resolveDiaSemanaMexico, todayMexicoSql } from './transporte-date.util';

interface PadreAssignment {
  ruta: TransporteRutaDetalle;
  alumno: TransporteAlumnoRuta;
}

@Injectable({
  providedIn: 'root',
})
export class PadreRutasService {
  private readonly apiUrl = Capacitor.isNativePlatform()
    ? environment.androidApiUrl
    : environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/transporte-escolar`;

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService
  ) {}

  getApiUrl(): string {
    return this.apiUrl;
  }

  getIdusrDefault(): number {
    return this.authService.getCurrentUserId() ?? environment.padreIdusr;
  }

  getIdorgDefault(): number {
    return this.authService.getCurrentUser()?.idorg ?? 0;
  }

  consultarDashboard(idusr = this.getIdusrDefault()): Observable<PadreDashboard> {
    const fecha = this.todayLocal();

    return this.consultarAlumnosPadre(idusr).pipe(
      switchMap((alumnosPadre) => {
        const matriculas = new Set(alumnosPadre.map((alumno) => alumno.idmatricula));

        if (matriculas.size === 0) {
          return of({ fecha, idusr, alumnosPadre, alumnos: [] });
        }

        return this.http.get<SpResponse<TransporteRutaListItem[]>>(`${this.baseUrl}/rutas?sitactivo=true`).pipe(
          switchMap((response) => {
            const rutas = response.result ?? [];

            if (rutas.length === 0) {
              return of({ fecha, idusr, alumnosPadre, alumnos: [] });
            }

            return forkJoin(rutas.map((ruta) => this.consultarRuta(ruta.idruta))).pipe(
              map((detalles) => detalles
                .flatMap((ruta) => this.findAssignments(ruta, matriculas, fecha))
              ),
              switchMap((assignments) => this.consultarAsignaciones(assignments, fecha)),
              map((alumnos) => this.priorizarRutasEnCurso(alumnos)),
              map((alumnos) => ({ fecha, idusr, alumnosPadre, alumnos }))
            );
          })
        );
      }),
      catchError((error) => {
        console.warn('No fue posible consultar informacion del padre de familia.', error);
        return of({ fecha, idusr, alumnosPadre: [], alumnos: [] });
      })
    );
  }

  listarRutasDisponiblesSolicitud(filter: {
    idorg: number;
    idmatricula: number;
    fecha: string;
    sentido: 'ENTRADA' | 'SALIDA';
  }): Observable<TransporteRutaDisponibleSolicitud[]> {
    const params = new URLSearchParams();
    params.set('idorg', String(filter.idorg));
    params.set('idmatricula', String(filter.idmatricula));
    params.set('fecha', filter.fecha);
    params.set('sentido', filter.sentido);

    return this.http.get<SpResponse<TransporteRutaDisponibleSolicitud[]>>(
      `${this.baseUrl}/padre/solicitudes/rutas-disponibles?${params.toString()}`
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result ?? [];
      })
    );
  }

  consultarRutaDetalle(idruta: number): Observable<TransporteRutaDetalle> {
    return this.consultarRuta(idruta);
  }

  crearSolicitudTransporte(request: CrearSolicitudTransporteRequest): Observable<TransporteSolicitud> {
    return this.http.post<SpResponse<TransporteSolicitud>>(
      `${this.baseUrl}/padre/solicitudes`,
      request
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as TransporteSolicitud;
      })
    );
  }

  cancelarSolicitudTransporte(
    idsolicitudtransporte: number,
    comentarios?: string | null
  ): Observable<TransporteSolicitud> {
    return this.http.put<SpResponse<TransporteSolicitud>>(
      `${this.baseUrl}/padre/solicitudes/${idsolicitudtransporte}/cancelar`,
      { comentarios: comentarios || null }
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as TransporteSolicitud;
      })
    );
  }

  listarSolicitudesPadre(filter: {
    idorg: number;
    idusr: number;
    idmatricula?: number | null;
    fecha?: string | null;
  }): Observable<TransporteSolicitud[]> {
    const params = new URLSearchParams();
    params.set('idorg', String(filter.idorg));
    params.set('idusr', String(filter.idusr));

    if (filter.idmatricula) {
      params.set('idmatricula', String(filter.idmatricula));
    }

    if (filter.fecha) {
      params.set('fecha', filter.fecha);
    }

    return this.http.get<SpResponse<TransporteSolicitud[]>>(
      `${this.baseUrl}/solicitudes?${params.toString()}`
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result ?? [];
      }),
      catchError(() => of([]))
    );
  }

  consultarUltimaGps(idruta: number): Observable<TransporteGpsPosicion | null> {
    return this.consultarGps(idruta);
  }

  private consultarAlumnosPadre(idusr: number): Observable<PadreAlumnoUsuario[]> {
    return this.http.get<SpResponse<PadreAlumnoUsuario[]>>(`${this.baseUrl}/padre/alumnos?idusr=${idusr}`).pipe(
      map((response) => response.result ?? [])
    );
  }

  private consultarRuta(idruta: number): Observable<TransporteRutaDetalle> {
    return this.http.get<SpResponse<TransporteRutaDetalle>>(`${this.baseUrl}/rutas/${idruta}`).pipe(
      map((response) => response.result as TransporteRutaDetalle)
    );
  }

  private consultarAsignaciones(
    assignments: PadreAssignment[],
    fecha: string
  ): Observable<PadreRutaAlumno[]> {
    if (assignments.length === 0) {
      return of([]);
    }

    return forkJoin(assignments.map((assignment) => forkJoin({
      recorrido: this.consultarRecorridoActual(assignment.ruta.idruta, fecha),
      gps: this.consultarGps(assignment.ruta.idruta),
      eventos: this.consultarEventos(assignment.ruta.idruta, assignment.alumno.idmatricula, fecha),
    }).pipe(
      map((context) => this.mapPadreRutaAlumno(assignment, context.recorrido, context.gps, context.eventos))
    )));
  }

  private consultarRecorridoActual(idruta: number, fecha: string): Observable<TransporteRecorrido | null> {
    return this.http.get<SpResponse<TransporteRecorrido>>(
      `${this.baseUrl}/rutas/${idruta}/recorridos/actual?fecha=${fecha}`
    ).pipe(
      map((response) => response.result ?? null),
      catchError(() => of(null))
    );
  }

  private consultarGps(idruta: number): Observable<TransporteGpsPosicion | null> {
    return this.http.get<SpResponse<TransporteGpsPosicion>>(`${this.baseUrl}/rutas/${idruta}/gps/ultima`).pipe(
      map((response) => response.result ?? null),
      catchError(() => of(null))
    );
  }

  private consultarEventos(idruta: number, idmatricula: number, fecha: string): Observable<TransporteEventoAlumno[]> {
    return this.http.get<SpResponse<TransporteEventoAlumno[]>>(
      `${this.baseUrl}/eventos?idruta=${idruta}&idmatricula=${idmatricula}&fecha=${fecha}`
    ).pipe(
      map((response) => response.result ?? []),
      catchError(() => of([]))
    );
  }

  private findAssignments(ruta: TransporteRutaDetalle, matriculas: Set<number>, fecha: string): PadreAssignment[] {
    return (ruta.alumnos ?? [])
      .filter((item) =>
      item.sitactivo !== false &&
      matriculas.has(item.idmatricula) &&
      this.isAlumnoDisponibleEnFecha(ruta, item, fecha)
    )
      .map((alumno) => ({ ruta, alumno }));
  }

  private isAlumnoDisponibleEnFecha(
    ruta: TransporteRutaDetalle,
    alumno: TransporteAlumnoRuta,
    fecha: string
  ): boolean {
    if ((ruta.tipoServicio ?? '').toUpperCase() !== 'REGULAR') {
      return true;
    }

    const dia = resolveDiaSemanaMexico(fecha);
    return alumno[dia] !== false;
  }

  private mapPadreRutaAlumno(
    assignment: PadreAssignment,
    recorrido: TransporteRecorrido | null,
    gps: TransporteGpsPosicion | null,
    eventos: TransporteEventoAlumno[]
  ): PadreRutaAlumno {
    const ruta = assignment.ruta;
    const alumno = assignment.alumno;
    const sentido = ruta.sentido === 'SALIDA' ? 'SALIDA' : 'ENTRADA';
    const parada = this.resolveParada(ruta, alumno, sentido);
    const ultimoEvento = this.resolveUltimoEvento(eventos);
    const aproximandose = this.isAproximandose(gps, parada);
    const estado = this.resolveEstado(recorrido, ultimoEvento);
    const rutaPuntos = this.resolveRutaPuntos(ruta, parada);

    return {
      idruta: ruta.idruta,
      descripcion: ruta.descripcion || ruta.clave || `Ruta ${ruta.idruta}`,
      sentido,
      turno: ruta.turno || 'Sin turno',
      unidad: ruta.asignacionActual?.numEconomico || ruta.unidad?.numEconomico || 'Sin unidad',
      placas: ruta.asignacionActual?.placas || ruta.unidad?.placas || 'Sin placas',
      conductor: ruta.asignacionActual?.conductor || ruta.conductor?.nombre || 'Conductor',
      alumno: alumno.alumno || `Alumno ${alumno.idmatricula}`,
      idmatricula: alumno.idmatricula,
      idalumnoruta: alumno.idalumnoruta,
      tipoServicio: ruta.tipoServicio,
      lunes: alumno.lunes,
      martes: alumno.martes,
      miercoles: alumno.miercoles,
      jueves: alumno.jueves,
      viernes: alumno.viernes,
      sabado: alumno.sabado,
      domingo: alumno.domingo,
      paradaNombre: parada?.nombre || 'Parada sin asignar',
      paradaHora: this.formatHora(parada?.horaProgramada),
      paradaLatitud: parada?.latitud ?? null,
      paradaLongitud: parada?.longitud ?? null,
      paradaRadioMetros: parada?.radioMetros ?? null,
      rutaPuntos,
      estado,
      estadoTexto: this.resolveEstadoTexto(estado, sentido, recorrido, aproximandose),
      rutaEstadoTexto: this.resolveRutaEstadoTexto(recorrido, aproximandose, ultimoEvento),
      aproximandose,
      ultimoEvento,
      recorrido,
      gps,
      eventos,
    };
  }

  private resolveParada(
    ruta: TransporteRutaDetalle,
    alumno: TransporteAlumnoRuta,
    sentido: 'ENTRADA' | 'SALIDA'
  ): TransporteParada | null {
    const idparada = sentido === 'ENTRADA'
      ? alumno.idrutaparadaSubida
      : alumno.idrutaparadaBajada;

    return (ruta.paradas ?? []).find((parada) => parada.idrutaparada === idparada) ?? null;
  }

  private resolveUltimoEvento(eventos: TransporteEventoAlumno[]): TransporteEventoAlumno | null {
    return eventos
      .slice()
      .sort((a, b) => String(b.fechaHora || '').localeCompare(String(a.fechaHora || '')))[0] ?? null;
  }

  private resolveRutaPuntos(ruta: TransporteRutaDetalle, paradaAlumno: TransporteParada | null): PadreRutaPunto[] {
    const limiteOrden = paradaAlumno?.orden ?? Number.MAX_SAFE_INTEGER;

    return (ruta.paradas ?? [])
      .filter((parada) =>
        parada.sitactivo !== false &&
        parada.orden <= limiteOrden &&
        parada.latitud !== null &&
        parada.latitud !== undefined &&
        parada.longitud !== null &&
        parada.longitud !== undefined
      )
      .sort((a, b) => a.orden - b.orden)
      .map((parada) => ({
        orden: parada.orden,
        nombre: parada.nombre || `Parada ${parada.orden}`,
        latitud: parada.latitud!,
        longitud: parada.longitud!,
      }));
  }

  private resolveEstado(
    recorrido: TransporteRecorrido | null,
    evento: TransporteEventoAlumno | null
  ): PadreRutaAlumno['estado'] {
    if (!recorrido) {
      return 'sin_recorrido';
    }

    if (evento?.tipoEvento === 'AUSENTE') {
      return 'ausente';
    }

    if (evento?.tipoEvento === 'INCIDENCIA') {
      return 'incidencia';
    }

    if (evento?.tipoEvento === 'BAJA') {
      return 'entregado';
    }

    if (evento?.tipoEvento === 'SUBE') {
      return 'en_unidad';
    }

    return 'esperando';
  }

  private resolveEstadoTexto(
    estado: PadreRutaAlumno['estado'],
    sentido: 'ENTRADA' | 'SALIDA',
    recorrido: TransporteRecorrido | null,
    aproximandose: boolean
  ): string {
    if (estado === 'incidencia') {
      return 'INCIDENCIA REPORTADA';
    }

    if (estado === 'ausente') {
      return sentido === 'ENTRADA'
        ? 'SU HIJO NO ABORDO EL TRANSPORTE ESCOLAR'
        : 'NO SE REGISTRO EL DESCENSO EN PARADA';
    }

    if (sentido === 'ENTRADA' && recorrido?.estatus === 'FINALIZADO') {
      return 'SU HIJO LLEGO A SU DESTINO';
    }

    if (estado === 'en_unidad') {
      return sentido === 'ENTRADA'
        ? 'SU HIJO ABORDO EL TRANSPORTE ESCOLAR'
        : 'SU HIJO CONTINUA EN TRAYECTO';
    }

    if (estado === 'entregado') {
      return sentido === 'ENTRADA'
        ? 'SU HIJO LLEGO A SU DESTINO'
        : 'SU HIJO DESCENDIO EN PARADA';
    }

    if (aproximandose) {
      return 'EL AUTOBUS ESTA PROXIMO A LLEGAR A LA PARADA';
    }

    if (recorrido?.estatus === 'EN_CURSO') {
      return 'RUTA EN TRAYECTO';
    }

    return sentido === 'ENTRADA' ? 'ESPERANDO ABORDAJE' : 'ESPERANDO DESCENSO';
  }

  private priorizarRutasEnCurso(alumnos: PadreRutaAlumno[]): PadreRutaAlumno[] {
    const byAlumno = new Map<number, PadreRutaAlumno[]>();

    alumnos.forEach((alumno) => {
      byAlumno.set(alumno.idmatricula, [...(byAlumno.get(alumno.idmatricula) ?? []), alumno]);
    });

    return Array.from(byAlumno.values()).flatMap((items) => {
      const enCurso = items.filter((item) => item.recorrido?.estatus === 'EN_CURSO');
      if (enCurso.length > 0) {
        return enCurso;
      }

      const conEventos = items.filter((item) => item.ultimoEvento);
      if (conEventos.length > 0) {
        return conEventos;
      }

      return items;
    });
  }

  private resolveRutaEstadoTexto(
    recorrido: TransporteRecorrido | null,
    aproximandose: boolean,
    evento: TransporteEventoAlumno | null
  ): string {
    if (!recorrido) {
      if (evento) {
        return 'Registro recibido hoy';
      }

      return 'Ruta pendiente';
    }

    if (recorrido.estatus === 'FINALIZADO') {
      return 'Ruta finalizada';
    }

    if (aproximandose) {
      return 'Dentro del radio de parada';
    }

    if (recorrido.estatus === 'EN_CURSO') {
      return 'Ruta en trayecto';
    }

    return 'Ruta pendiente';
  }

  private isAproximandose(gps: TransporteGpsPosicion | null, parada: TransporteParada | null): boolean {
    if (!gps?.latitud || !gps.longitud || !parada?.latitud || !parada.longitud) {
      return false;
    }

    return this.distanceMeters(gps.latitud, gps.longitud, parada.latitud, parada.longitud) <= (parada.radioMetros ?? 80);
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

  private formatHora(value?: string | null): string {
    if (!value) {
      return '--:--';
    }

    const match = value.match(/^(\d{2}):(\d{2})/);
    return match ? formatClockAmPm(Number(match[1]), Number(match[2])) : '--:--';
  }

  private todayLocal(): string {
    return todayMexicoSql();
  }

  private assertSuccess<T>(response: SpResponse<T>): void {
    if (response.codeNumber && response.codeNumber !== 200) {
      throw new Error(response.message || 'No fue posible completar la operacion.');
    }
  }
}
