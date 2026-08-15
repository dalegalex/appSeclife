import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  EventoFamiliarPase,
  EventoFamiliarRespuesta,
  EventoFamiliarSocial,
  GuardarEventoFamiliarSocialRequest,
  SpEventoFamiliarResponse,
} from '../models/evento-familiar-social.model';

@Injectable({ providedIn: 'root' })
export class EventoFamiliarSocialService {
  private readonly apiUrl = Capacitor.isNativePlatform() ? environment.androidApiUrl : environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/control-accesos/red-familiar/eventos-familiares`;

  constructor(private readonly http: HttpClient) {}

  consultar(idorg: number): Observable<EventoFamiliarSocial[]> {
    const params = new HttpParams().set('idorg', String(idorg));
    return this.http.get<SpEventoFamiliarResponse<EventoFamiliarSocial[]>>(this.baseUrl, { params })
      .pipe(map(r => this.result(r) ?? []), catchError(e => this.error(e)));
  }

  guardar(request: GuardarEventoFamiliarSocialRequest, ideventofamiliar?: number | null): Observable<EventoFamiliarSocial> {
    const payload: GuardarEventoFamiliarSocialRequest = {
      ...request,
      horaEvento: this.normalizeTime(request.horaEvento),
      horaSalidaColegio: this.normalizeTime(request.horaSalidaColegio),
      maxAlumnosInvitados: Number(request.maxAlumnosInvitados),
    };
    const call = ideventofamiliar
      ? this.http.put<SpEventoFamiliarResponse<EventoFamiliarSocial>>(`${this.baseUrl}/${ideventofamiliar}`, payload)
      : this.http.post<SpEventoFamiliarResponse<EventoFamiliarSocial>>(this.baseUrl, payload);
    return call.pipe(map(r => this.result(r) as EventoFamiliarSocial), catchError(e => this.error(e)));
  }

  publicar(ideventofamiliar: number, idorg: number): Observable<EventoFamiliarPase> {
    return this.http.post<SpEventoFamiliarResponse<EventoFamiliarPase>>(
      `${this.baseUrl}/${ideventofamiliar}/publicar`, { idorg }
    ).pipe(map(r => this.result(r) as EventoFamiliarPase), catchError(e => this.error(e)));
  }

  resolver(idorg: number, codigo?: string | null, tokenUid?: string | null): Observable<EventoFamiliarSocial> {
    return this.http.post<SpEventoFamiliarResponse<EventoFamiliarSocial>>(`${this.baseUrl}/resolver`, {
      idorg, codigo: codigo || null, tokenUid: tokenUid || null,
    }).pipe(map(r => this.result(r) as EventoFamiliarSocial), catchError(e => this.error(e)));
  }

  consultarRespuestas(ideventofamiliar: number, idorg: number): Observable<EventoFamiliarRespuesta[]> {
    const params = new HttpParams().set('idorg', String(idorg));
    return this.http.get<SpEventoFamiliarResponse<EventoFamiliarRespuesta[]>>(
      `${this.baseUrl}/${ideventofamiliar}/respuestas`, { params }
    ).pipe(map(r => this.result(r) ?? []), catchError(e => this.error(e)));
  }

  responder(evento: EventoFamiliarSocial, idorg: number, confirmar: boolean): Observable<EventoFamiliarSocial> {
    return this.http.put<SpEventoFamiliarResponse<EventoFamiliarSocial>>(
      `${this.baseUrl}/respuestas/${evento.idrespuestaevento}`,
      {
        idorg,
        estatusRespuesta: confirmar ? 'CONFIRMADA' : 'RECHAZADA',
        alumnos: confirmar
          ? (evento.alumnos ?? []).filter(a => !!a.seleccionado).map(a => ({
              idmatricula: a.idmatricula,
              confirmaAsistencia: true,
              autorizaSalida: !!a.autorizaSalida,
            }))
          : [],
      }
    ).pipe(map(r => this.result(r) as EventoFamiliarSocial), catchError(e => this.error(e)));
  }

  cancelar(ideventofamiliar: number, idorg: number): Observable<unknown> {
    return this.http.request<SpEventoFamiliarResponse<unknown>>('delete', `${this.baseUrl}/${ideventofamiliar}`, {
      body: { idorg },
    }).pipe(map(r => this.result(r)), catchError(e => this.error(e)));
  }

  private result<T>(response: SpEventoFamiliarResponse<T>): T | null {
    if (response.codeNumber !== 200) throw new Error(response.message || 'No fue posible completar la operacion.');
    return response.result ?? null;
  }

  private error(error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      const validationErrors = error.error?.errors as Record<string, string[]> | undefined;
      const validationMessage = validationErrors
        ? Object.values(validationErrors).flat().filter(Boolean).join(' ')
        : null;
      return throwError(() => new Error(
        error.error?.message || validationMessage || error.message || 'No fue posible completar la operacion.'
      ));
    }
    return throwError(() => error);
  }

  private normalizeTime(value?: string | null): string | null {
    const time = (value ?? '').trim();
    if (!time) return null;
    return time.length === 5 ? `${time}:00` : time;
  }
}
