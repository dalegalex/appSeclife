import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { BitacoraAccesoResponse } from '../models/bitacora-acceso.model';
import { SpResponse } from '../models/red-familiar.model';

@Injectable({
  providedIn: 'root',
})
export class BitacoraAccesoService {
  private readonly apiUrl = Capacitor.isNativePlatform()
    ? environment.androidApiUrl
    : environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/control-accesos`;

  constructor(private readonly http: HttpClient) {}

  consultarAlumno(
    idorg: number,
    idmatricula: number,
    fechaInicio: string,
    fechaFin: string
  ): Observable<BitacoraAccesoResponse> {
    const params = new HttpParams()
      .set('idorg', String(idorg))
      .set('fechaInicio', fechaInicio)
      .set('fechaFin', fechaFin);

    return this.http.get<SpResponse<BitacoraAccesoResponse>>(
      `${this.baseUrl}/alumnos/${idmatricula}/bitacora`,
      { params }
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result ?? { eventos: [] };
      })
    );
  }

  private assertSuccess<T>(response: SpResponse<T>): void {
    if (response.codeNumber && response.codeNumber !== 200) {
      throw new Error(response.message || 'No fue posible consultar la bitacora.');
    }
  }
}
