import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  FichaPersonalDetalle,
  GuardarExperienciaFichaRequest,
  RegistrarDocumentoFichaRequest,
  SpResponse,
} from '../models/ficha-personal.model';

@Injectable({
  providedIn: 'root',
})
export class FichaPersonalService {
  private readonly apiUrl = Capacitor.isNativePlatform()
    ? environment.androidApiUrl
    : environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/ficha-personal`;

  constructor(private readonly http: HttpClient) {}

  consultarMiFicha(): Observable<SpResponse<FichaPersonalDetalle>> {
    return this.http.get<SpResponse<FichaPersonalDetalle>>(`${this.baseUrl}/mi-ficha`);
  }

  guardarMiFicha(request: Record<string, unknown>): Observable<SpResponse<FichaPersonalDetalle>> {
    return this.http.put<SpResponse<FichaPersonalDetalle>>(`${this.baseUrl}/mi-ficha`, request);
  }

  registrarMiDocumento(request: RegistrarDocumentoFichaRequest): Observable<SpResponse<{ idusrfichadocumento: number }>> {
    return this.http.post<SpResponse<{ idusrfichadocumento: number }>>(
      `${this.baseUrl}/mi-ficha/documentos`,
      request
    );
  }

  eliminarMiDocumento(idusrfichadocumento: number): Observable<SpResponse<{ idusrfichadocumento: number }>> {
    return this.http.delete<SpResponse<{ idusrfichadocumento: number }>>(
      `${this.baseUrl}/mi-ficha/documentos/${idusrfichadocumento}`
    );
  }

  documentoArchivoUrl(idusrfichadocumento: number): string {
    return `${this.baseUrl}/documentos/${idusrfichadocumento}/archivo`;
  }

  guardarMiExperiencia(request: GuardarExperienciaFichaRequest): Observable<SpResponse<{ idusrfichaexperiencia: number }>> {
    const endpoint = request.idusrfichaexperiencia
      ? `${this.baseUrl}/mi-ficha/experiencias/${request.idusrfichaexperiencia}`
      : `${this.baseUrl}/mi-ficha/experiencias`;

    return request.idusrfichaexperiencia
      ? this.http.put<SpResponse<{ idusrfichaexperiencia: number }>>(endpoint, request)
      : this.http.post<SpResponse<{ idusrfichaexperiencia: number }>>(endpoint, request);
  }
}
