import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import {
  ConductorAlumno,
  ConductorParada,
  ConductorRuta,
  SpResponse,
  TransporteAlumnoRuta,
  TransporteEventoAlumno,
  TransporteParada,
  TransporteRecorrido,
  TransporteRutaDetalle,
  TransporteRutaListItem,
} from '../models/conductor-ruta.model';
import { TransporteGpsPosicion } from '../models/padre-ruta.model';
import { nowMexicoSql, resolveDiaSemanaMexico, todayMexicoSql } from './transporte-date.util';

@Injectable({
  providedIn: 'root',
})
export class ConductorRutasService {
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

  listarMisRutas(): Observable<ConductorRuta[]> {
    if (environment.useMockTransporte) {
      return of(this.getFallbackRutas());
    }

    return this.http.get<SpResponse<TransporteRutaListItem[]>>(`${this.baseUrl}/mis-rutas`).pipe(
      switchMap((response) => {
        const rutas = response.result ?? [];

        if (rutas.length === 0) {
          return of([]);
        }

        return forkJoin(rutas.map((ruta) => this.consultarRuta(ruta.idruta)));
      }),
      catchError((error) => {
        console.warn('No fue posible consultar rutas del conductor.', error);
        return throwError(() => new Error(this.resolveHttpErrorMessage(error)));
      })
    );
  }

  consultarRuta(idruta: number): Observable<ConductorRuta> {
    return this.http.get<SpResponse<TransporteRutaDetalle>>(`${this.baseUrl}/rutas/${idruta}`).pipe(
      map((response) => this.mapRutaDetalle(response.result))
    );
  }

  registrarEventoAlumno(
    idrecorrido: number | null | undefined,
    alumno: ConductorAlumno,
    tipoEvento: 'SUBE' | 'BAJA' | 'AUSENTE' | 'INCIDENCIA',
    latitud?: number | null,
    longitud?: number | null,
    clientEventId?: string | null,
    fechaHora?: string | null
  ): Observable<SpResponse<unknown>> {
    return this.http.post<SpResponse<unknown>>(`${this.baseUrl}/eventos`, {
      clientEventId,
      idrecorrido,
      idalumnoruta: alumno.idalumnoruta,
      idrutaparada: alumno.idrutaparada,
      tipoEvento,
      fechaHora: fechaHora || this.nowLocalSql(),
      latitud,
      longitud,
      origen: this.resolveOrigenOperador(),
      comentarios: tipoEvento === 'INCIDENCIA' ? 'Incidencia registrada desde app movil.' : null,
    }).pipe(
      catchError((error) => {
        console.warn('No fue posible registrar evento de alumno.', error);
        return of({
          result: null,
          message: this.resolveHttpErrorMessage(error),
          codeNumber: 0,
        });
      })
    );
  }

  registrarGps(
    idrecorrido: number | null | undefined,
    idruta: number,
    idunidad: number,
    latitud: number,
    longitud: number,
    clientEventId?: string | null,
    fechaHora?: string | null,
    precisionMetros?: number | null
  ): Observable<SpResponse<unknown>> {
    return this.http.post<SpResponse<unknown>>(`${this.baseUrl}/gps`, {
      clientEventId,
      idrecorrido,
      idruta,
      idunidad,
      fechaHora: fechaHora || this.nowLocalSql(),
      latitud,
      longitud,
      precisionMetros,
      origen: this.resolveOrigenOperador(),
    }).pipe(
      catchError((error) => {
        console.warn('No fue posible registrar GPS.', error);
        return of({
          result: null,
          message: this.resolveHttpErrorMessage(error),
          codeNumber: 0,
        });
      })
    );
  }

  consultarUltimaGps(idruta: number): Observable<TransporteGpsPosicion | null> {
    return this.http.get<SpResponse<TransporteGpsPosicion>>(`${this.baseUrl}/rutas/${idruta}/gps/ultima`).pipe(
      map((response) => response.result ?? null),
      catchError(() => of(null))
    );
  }

  iniciarRecorrido(ruta: ConductorRuta): Observable<SpResponse<TransporteRecorrido>> {
    return this.http.post<SpResponse<TransporteRecorrido>>(
      `${this.baseUrl}/rutas/${ruta.idruta}/recorridos/iniciar`,
      {
        idunidad: ruta.idunidad,
        fechaHora: this.nowLocalSql(),
        origen: this.resolveOrigenOperador(),
      }
    );
  }

  finalizarRecorrido(idrecorrido: number): Observable<SpResponse<TransporteRecorrido>> {
    return this.http.put<SpResponse<TransporteRecorrido>>(
      `${this.baseUrl}/recorridos/${idrecorrido}/finalizar`,
      {
        fechaHora: this.nowLocalSql(),
        comentarios: 'Recorrido finalizado desde app movil.',
      }
    );
  }

  consultarRecorridoActual(idruta: number): Observable<SpResponse<TransporteRecorrido>> {
    const fecha = this.todayLocal();
    return this.http.get<SpResponse<TransporteRecorrido>>(
      `${this.baseUrl}/rutas/${idruta}/recorridos/actual?fecha=${fecha}`
    );
  }

  private resolveHttpErrorMessage(error: unknown): string {
    const httpError = error as Partial<HttpErrorResponse> & {
      error?: unknown;
      message?: string;
      status?: number;
      statusText?: string;
    };

    const status = typeof httpError.status === 'number' ? httpError.status : null;
    const detail = this.resolveErrorDetail(httpError.error) || httpError.message || 'Sin detalle del error';

    if (status === 0) {
      return `Sin conexion al API (${this.apiUrl}). ${detail}`;
    }

    if (status) {
      return `API ${status}: ${detail}`;
    }

    return `No fue posible sincronizar la ubicacion con el API. ${detail}`;
  }

  private resolveErrorDetail(error: unknown): string | null {
    if (!error) {
      return null;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (typeof error === 'object') {
      const value = error as { message?: unknown; title?: unknown; error?: unknown };
      const message = typeof value.message === 'string' ? value.message : null;
      const title = typeof value.title === 'string' ? value.title : null;
      const nestedError = typeof value.error === 'string' ? value.error : null;

      return message || title || nestedError || JSON.stringify(value).slice(0, 180);
    }

    return String(error);
  }

  private mapRutaDetalle(ruta: TransporteRutaDetalle | null): ConductorRuta {
    if (!ruta) {
      throw new Error('El API no devolvio el detalle de la ruta solicitada.');
    }

    const sentido = ruta.sentido === 'SALIDA' ? 'SALIDA' : 'ENTRADA';
    const paradas = (ruta.paradas ?? [])
      .filter((parada) => parada.sitactivo !== false)
      .sort((a, b) => a.orden - b.orden);

    const fechaServicio = this.todayLocal();
    const alumnos = (ruta.alumnos ?? []).filter((alumno) =>
      alumno.sitactivo !== false &&
      this.isAlumnoDisponibleEnFecha(ruta, alumno, fechaServicio)
    );

    return {
      idrecorrido: null,
      idruta: ruta.idruta,
      idunidad: ruta.asignacionActual?.idunidad ?? ruta.unidad?.idunidad ?? null,
      descripcion: ruta.descripcion || ruta.clave || `Ruta ${ruta.idruta}`,
      sentido,
      turno: ruta.turno || 'Sin turno',
      unidad: ruta.asignacionActual?.numEconomico || ruta.unidad?.numEconomico || 'Sin unidad',
      placas: ruta.asignacionActual?.placas || ruta.unidad?.placas || 'Sin placas',
      conductor: ruta.asignacionActual?.conductor || ruta.conductor?.nombre || 'Conductor',
      estatus: 'pendiente',
      intervaloGpsSegundos: ruta.intervaloGpsSegundos ?? null,
      paradas: paradas.map((parada) => this.mapParada(parada, alumnos, sentido)),
      modoPrueba: false,
    };
  }

  aplicarEventosRecorrido(ruta: ConductorRuta, eventos: TransporteEventoAlumno[] = []): ConductorRuta {
    const ultimoEventoPorAlumno = new Map<number, TransporteEventoAlumno>();

    eventos
      .slice()
      .sort((a, b) => String(a.fechaHora || '').localeCompare(String(b.fechaHora || '')))
      .forEach((evento) => {
        ultimoEventoPorAlumno.set(evento.idalumnoruta, evento);
      });

    ruta.paradas.forEach((parada) => {
      parada.alumnos.forEach((alumno) => {
        const evento = ultimoEventoPorAlumno.get(alumno.idalumnoruta);
        if (!evento?.tipoEvento) {
          alumno.estado = 'pendiente';
          alumno.ultimoEvento = null;
          return;
        }

        alumno.ultimoEvento = evento.tipoEvento;
        alumno.estado = evento.tipoEvento === 'AUSENTE'
          ? 'ausente'
          : evento.tipoEvento === 'INCIDENCIA'
            ? 'incidencia'
            : 'registrado';
      });
    });

    return ruta;
  }

  private mapParada(
    parada: TransporteParada,
    alumnos: TransporteAlumnoRuta[],
    sentido: 'ENTRADA' | 'SALIDA'
  ): ConductorParada {
    const alumnosParada = alumnos.filter((alumno) => {
      const idparada = sentido === 'ENTRADA'
        ? alumno.idrutaparadaSubida
        : alumno.idrutaparadaBajada;

      return idparada === parada.idrutaparada;
    });

    return {
      idrutaparada: parada.idrutaparada,
      orden: parada.orden,
      nombre: parada.nombre,
      horaProgramada: this.formatHora(parada.horaProgramada),
      latitud: parada.latitud ?? null,
      longitud: parada.longitud ?? null,
      radioMetros: parada.radioMetros ?? null,
      alumnos: alumnosParada.map((alumno) => this.mapAlumno(alumno, parada.idrutaparada, parada.nombre)),
    };
  }

  private mapAlumno(alumno: TransporteAlumnoRuta, idrutaparada: number, parada: string): ConductorAlumno {
    return {
      idalumnoruta: alumno.idalumnoruta,
      idrutaparada,
      nombre: alumno.alumno || `Alumno ${alumno.idmatricula}`,
      grado: `Matricula ${alumno.idmatricula}`,
      parada,
      estado: 'pendiente',
    };
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

  private formatHora(value?: string | null): string {
    if (!value) {
      return '--:--';
    }

    return value.slice(0, 5);
  }

  private nowLocalSql(): string {
    return nowMexicoSql();
  }

  private todayLocal(): string {
    return todayMexicoSql();
  }

  private resolveOrigenOperador(): string {
    return this.authService.getCurrentProfileId() === 11 ? 'APP_ASISTENTE_RUTA' : 'APP_CONDUCTOR';
  }

  private getFallbackRutas(): ConductorRuta[] {
    return [
      {
        idruta: 6,
        idunidad: 1,
        descripcion: 'Ruta Norte - Entrada',
        sentido: 'ENTRADA',
        turno: 'Matutino',
        unidad: 'BUS-01',
        placas: 'TES-001-A',
        conductor: 'Juan Perez',
        estatus: 'pendiente',
        intervaloGpsSegundos: 5,
        modoPrueba: true,
        paradas: [
          {
            idrutaparada: 101,
            orden: 1,
            nombre: 'Punto de salida',
            horaProgramada: '06:45',
            alumnos: [
              {
                idalumnoruta: 1001,
                idrutaparada: 101,
                nombre: 'Valeria Gomez',
                grado: 'Primaria 3',
                parada: 'Punto de salida',
                estado: 'pendiente',
              },
            ],
          },
          {
            idrutaparada: 102,
            orden: 2,
            nombre: 'Parada Robles',
            horaProgramada: '07:05',
            alumnos: [
              {
                idalumnoruta: 1002,
                idrutaparada: 102,
                nombre: 'Mateo Hernandez',
                grado: 'Primaria 4',
                parada: 'Parada Robles',
                estado: 'pendiente',
              },
              {
                idalumnoruta: 1003,
                idrutaparada: 102,
                nombre: 'Sofia Ramirez',
                grado: 'Secundaria 1',
                parada: 'Parada Robles',
                estado: 'pendiente',
              },
            ],
          },
          {
            idrutaparada: 103,
            orden: 3,
            nombre: 'Colegio',
            horaProgramada: '07:35',
            alumnos: [],
          },
        ],
      },
    ];
  }
}
