import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CrearEventoPushRequest,
  GuardarNotificacionPushPreferenciaRequest,
  NotificacionPushHistorialFilters,
  NotificacionPushHistorialPage,
  NotificacionPushPreferencia,
  RegistrarDispositivoPushRequest,
  SpResponse,
} from '../models/notificaciones-push.model';

@Injectable({
  providedIn: 'root',
})
export class NotificacionesPushService {
  private readonly apiUrl = Capacitor.isNativePlatform()
    ? environment.androidApiUrl
    : environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/notificaciones-push`;

  constructor(private readonly http: HttpClient) {}

  registrarDispositivo(request: RegistrarDispositivoPushRequest): Observable<boolean> {
    return this.http.post<SpResponse<{ tokenRegistrado: boolean }>>(`${this.baseUrl}/dispositivos`, request).pipe(
      map((response) => {
        this.assertSuccess(response);
        return !!response.result?.tokenRegistrado;
      })
    );
  }

  bajaDispositivo(deviceId: string): Observable<boolean> {
    return this.http.delete<SpResponse<{ dispositivoDadoDeBaja: boolean }>>(
      `${this.baseUrl}/dispositivos/${encodeURIComponent(deviceId)}`,
      { params: new HttpParams().set('app', 'appSeclife') }
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return !!response.result?.dispositivoDadoDeBaja;
      })
    );
  }

  consultarPreferencias(idmatricula?: number | null): Observable<NotificacionPushPreferencia[]> {
    let params = new HttpParams();
    if (idmatricula) {
      params = params.set('idmatricula', String(idmatricula));
    }

    return this.http.get<SpResponse<NotificacionPushPreferencia[]>>(`${this.baseUrl}/preferencias`, { params }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result ?? [];
      })
    );
  }

  guardarPreferencias(preferencias: GuardarNotificacionPushPreferenciaRequest[]): Observable<boolean> {
    return this.http.put<SpResponse<{ preferenciasGuardadas: boolean }>>(`${this.baseUrl}/preferencias`, {
      preferencias,
    }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return !!response.result?.preferenciasGuardadas;
      })
    );
  }

  consultarHistorial(filters: NotificacionPushHistorialFilters): Observable<NotificacionPushHistorialPage> {
    let params = new HttpParams()
      .set('page', String(filters.page))
      .set('pageSize', String(filters.pageSize));

    if (filters.idmatricula) {
      params = params.set('idmatricula', String(filters.idmatricula));
    }
    if (filters.estado) {
      params = params.set('estado', filters.estado);
    }
    if (filters.tipoEvento) {
      params = params.set('tipoEvento', filters.tipoEvento);
    }
    if (filters.texto.trim()) {
      params = params.set('texto', filters.texto.trim());
    }

    return this.http.get<SpResponse<NotificacionPushHistorialPage>>(`${this.baseUrl}/historial`, { params }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result ?? {
          page: filters.page,
          pageSize: filters.pageSize,
          total: 0,
          totalNoLeidas: 0,
          items: [],
        };
      })
    );
  }

  marcarLeida(idnotificacion: number): Observable<boolean> {
    return this.http.post<SpResponse<{ leida: boolean }>>(`${this.baseUrl}/${idnotificacion}/leida`, {}).pipe(
      map((response) => {
        this.assertSuccess(response);
        return !!response.result?.leida;
      })
    );
  }

  crearEvento(request: CrearEventoPushRequest): Observable<unknown> {
    return this.http.post<SpResponse<unknown>>(`${this.baseUrl}/eventos`, request).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result ?? null;
      })
    );
  }

  private assertSuccess<T>(response: SpResponse<T>): void {
    if (response.codeNumber !== 200) {
      throw new Error(response.message || 'No fue posible procesar la solicitud.');
    }
  }
}
