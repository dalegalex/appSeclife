import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  EventoInvitacionFamiliar,
  MisInvitacionesEventoResult,
  ResponderInvitacionEventoRequest,
  SpResponse,
} from '../models/evento-invitacion.model';

@Injectable({ providedIn: 'root' })
export class EventoInvitacionService {
  private readonly apiUrl = Capacitor.isNativePlatform()
    ? environment.androidApiUrl
    : environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/control-accesos/eventos/invitaciones`;

  constructor(private readonly http: HttpClient) {}

  consultarMias(): Observable<EventoInvitacionFamiliar[]> {
    return this.http
      .get<SpResponse<MisInvitacionesEventoResult>>(`${this.baseUrl}/mias`)
      .pipe(
        map((response) => {
          this.assertSuccess(response);
          return response.result?.invitaciones ?? [];
        }),
        catchError((error) => this.handleError(error))
      );
  }

  responder(
    idinvitacion: number,
    request: ResponderInvitacionEventoRequest
  ): Observable<EventoInvitacionFamiliar> {
    return this.http
      .put<SpResponse<EventoInvitacionFamiliar>>(
        `${this.baseUrl}/${idinvitacion}/respuesta`,
        request
      )
      .pipe(
        map((response) => {
          this.assertSuccess(response);
          return response.result as EventoInvitacionFamiliar;
        }),
        catchError((error) => this.handleError(error))
      );
  }

  private assertSuccess<T>(response: SpResponse<T>): void {
    if (response.codeNumber !== 200) {
      throw new Error(response.message || 'No fue posible completar la operacion.');
    }
  }
  private handleError(error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      const apiMessage =
        typeof error.error === 'object' && error.error !== null
          ? (error.error as { message?: string | null }).message
          : null;
      return throwError(
        () => new Error(apiMessage || error.message || 'No fue posible completar la operacion.')
      );
    }
    return throwError(() => error);
  }
}
