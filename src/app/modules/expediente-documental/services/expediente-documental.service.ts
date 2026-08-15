import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp, HttpHeaders, HttpResponse } from '@capacitor/core';
import { from, map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import {
  DetalleAsignacion,
  DocumentoFirmante,
  ExpedienteContexto,
  OtpRegistration,
  ProponerRepresentacionRequest,
  RepresentacionFamiliar,
  SpResponse,
} from '../models/expediente-documental.model';

@Injectable({ providedIn: 'root' })
export class ExpedienteDocumentalService {
  private readonly apiUrl = Capacitor.isNativePlatform() ? environment.androidApiUrl : environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/expediente-documental/mi-expediente`;

  constructor(private readonly http: HttpClient, private readonly auth: AuthService) {}

  contexto(): Observable<SpResponse<ExpedienteContexto>> {
    return this.json<SpResponse<ExpedienteContexto>>('GET', `${this.baseUrl}/contexto`);
  }

  representaciones(idmatricula?: number): Observable<SpResponse<RepresentacionFamiliar[]>> {
    const url = idmatricula ? `${this.baseUrl}/representaciones?idmatricula=${idmatricula}` : `${this.baseUrl}/representaciones`;
    return this.json<SpResponse<RepresentacionFamiliar[]>>('GET', url);
  }

  proponer(body: ProponerRepresentacionRequest): Observable<SpResponse<{ idrepresentacionlegal: number }>> {
    return this.json('POST', `${this.baseUrl}/representaciones`, body);
  }

  cargarSoporte(id: number, file: File, tipoSoporte: string): Observable<SpResponse<unknown>> {
    const form = new FormData();
    form.append('archivo', file, file.name);
    form.append('tipoSoporte', tipoSoporte);
    form.append('finalidad', 'ACREDITACION_REPRESENTACION');
    return this.http.post<SpResponse<unknown>>(`${this.baseUrl}/representaciones/${id}/soportes`, form);
  }

  documentos(): Observable<SpResponse<DocumentoFirmante[]>> {
    return this.json('GET', `${this.baseUrl}/documentos`);
  }

  detalle(id: number): Observable<SpResponse<DetalleAsignacion>> {
    return this.json('GET', `${this.baseUrl}/documentos/${id}`);
  }

  registrarFirma(id: number, jpeg: Blob): Observable<SpResponse<OtpRegistration>> {
    const form = new FormData();
    form.append('firma', jpeg, `firma-${id}.jpg`);
    return this.http.post<SpResponse<OtpRegistration>>(`${this.baseUrl}/documentos/${id}/firma`, form);
  }

  confirmarOtp(id: number, idotpdesafio: number, nonce: string, codigo: string): Observable<SpResponse<{ estatus: string }>> {
    return this.json('POST', `${this.baseUrl}/documentos/${id}/otp/confirmar`, { idotpdesafio, nonce, codigo });
  }

  rechazar(id: number, motivo: string): Observable<SpResponse<{ estatus: string }>> {
    return this.json('POST', `${this.baseUrl}/documentos/${id}/rechazar`, { motivo });
  }

  archivo(id: number): Observable<Blob> {
    return this.blob(`${this.baseUrl}/documentos/${id}/archivo`, 'application/pdf');
  }

  evidencia(id: number): Observable<Blob> {
    return this.blob(`${this.baseUrl}/documentos/${id}/evidencia`, 'application/pdf');
  }

  private json<T>(method: string, url: string, data?: unknown): Observable<T> {
    if (!Capacitor.isNativePlatform()) {
      if (method === 'GET') return this.http.get<T>(url);
      return this.http.request<T>(method, url, { body: data });
    }
    const headers: HttpHeaders = { Accept: 'application/json', 'Content-Type': 'application/json' };
    const token = this.auth.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return from(CapacitorHttp.request({ method, url, data, headers, responseType: 'json' })).pipe(
      map(response => {
        if (response.status >= 200 && response.status < 300) return response.data as T;
        throw this.apiError(response.status, response.data);
      })
    );
  }

  private blob(url: string, mimeType: string): Observable<Blob> {
    if (!Capacitor.isNativePlatform()) return this.http.get(url, { responseType: 'blob' });
    const headers: HttpHeaders = { Accept: mimeType };
    const token = this.auth.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return from(CapacitorHttp.request({ method: 'GET', url, headers, responseType: 'blob', readTimeout: 60000 })).pipe(
      map((response: HttpResponse) => {
        if (response.status < 200 || response.status >= 300) throw this.apiError(response.status, response.data);
        if (response.data instanceof Blob) return response.data;
        const base64 = String(response.data ?? '').replace(/\s/g, '');
        const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
        return new Blob([bytes], { type: mimeType });
      })
    );
  }

  private apiError(status: number, data: any): Error {
    const message = typeof data?.message === 'string' ? data.message : `GpsApi devolvio HTTP ${status}.`;
    return Object.assign(new Error(message), { status, error: data });
  }
}
