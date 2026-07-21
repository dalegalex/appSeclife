import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AvisoAsistencia,
  AvisosAsistenciaFamiliaResponse,
  CrearAvisoAsistenciaRequest,
  SpResponse,
} from '../models/aviso-asistencia.model';

@Injectable({
  providedIn: 'root',
})
export class AvisoAsistenciaService {
  private readonly apiUrl = Capacitor.isNativePlatform()
    ? environment.androidApiUrl
    : environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/control-accesos`;

  constructor(private readonly http: HttpClient) {}

  crear(request: CrearAvisoAsistenciaRequest): Observable<AvisoAsistencia | null> {
    return this.http.post<SpResponse<AvisoAsistencia>>(`${this.baseUrl}/familiares/asistencia/avisos`, request).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result ?? null;
      })
    );
  }

  cancelar(idorg: number, idpermisoalumno: number): Observable<AvisoAsistencia | null> {
    return this.http.put<SpResponse<AvisoAsistencia>>(
      `${this.baseUrl}/asistencia/avisos/${idpermisoalumno}/resolver`,
      {
        idorg,
        estatus: 'CANCELADO',
        comentariosResolucion: 'Solicitud cancelada por el padre de familia.',
      }
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result ?? null;
      })
    );
  }

  listar(idorg: number, idmatricula?: number | null): Observable<AvisoAsistencia[]> {
    let params = new HttpParams().set('idorg', String(idorg));
    if (idmatricula) {
      params = params.set('idmatricula', String(idmatricula));
    }

    return this.http.get<SpResponse<AvisosAsistenciaFamiliaResponse>>(
      `${this.baseUrl}/familiares/asistencia/avisos`,
      { params }
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result?.avisos ?? [];
      })
    );
  }

  private assertSuccess<T>(response: SpResponse<T>): void {
    if (response.codeNumber !== 200) {
      throw new Error(response.message || 'No fue posible procesar la solicitud.');
    }
  }
}
