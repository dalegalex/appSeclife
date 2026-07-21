import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CredencialDigital } from '../models/credencial-digital.model';
import { SpResponse } from '../models/red-familiar.model';

@Injectable({
  providedIn: 'root',
})
export class CredencialDigitalService {
  private readonly apiUrl = Capacitor.isNativePlatform()
    ? environment.androidApiUrl
    : environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/control-accesos`;

  constructor(private readonly http: HttpClient) {}

  consultarVigente(contexto: { idorg: number; idua?: number | null }): Observable<CredencialDigital> {
    let params = new HttpParams().set('idorg', String(contexto.idorg));

    if (contexto.idua) {
      params = params.set('idua', String(contexto.idua));
    }

    return this.http.get<SpResponse<CredencialDigital>>(`${this.baseUrl}/credencial-digital`, { params }).pipe(
      map((response) => {
        console.log('[CredencialDigitalService] consultarVigente response', response);
        this.assertSuccess(response);
        if (!response.result) {
          throw new Error('No se encontro una credencial digital vigente.');
        }

        return response.result;
      })
    );
  }

  private assertSuccess<T>(response: SpResponse<T>): void {
    if (response.codeNumber && response.codeNumber !== 200) {
      throw new Error(response.message || 'No fue posible consultar la credencial digital.');
    }
  }
}
