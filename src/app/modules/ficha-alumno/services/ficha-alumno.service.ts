import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp, HttpHeaders, HttpResponse } from '@capacitor/core';
import { from, map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import {
  FichaAlumnoDetalle,
  FichaAlumnoResumen,
  RegistrarDocumentoAlumnoRequest,
  ResponderAutorizacionAlumnoRequest,
  SpResponse,
} from '../models/ficha-alumno.model';

@Injectable({
  providedIn: 'root',
})
export class FichaAlumnoService {
  private readonly apiUrl = Capacitor.isNativePlatform()
    ? environment.androidApiUrl
    : environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/ficha-alumno`;

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService
  ) {}

  listarMisAlumnos(): Observable<SpResponse<FichaAlumnoResumen[]>> {
    if (Capacitor.isNativePlatform()) {
      return this.nativeRequest<SpResponse<FichaAlumnoResumen[]>>('GET', `${this.baseUrl}/mis-alumnos`);
    }

    return this.http.get<SpResponse<FichaAlumnoResumen[]>>(`${this.baseUrl}/mis-alumnos`);
  }

  consultarMiAlumno(idmatricula: number): Observable<SpResponse<FichaAlumnoDetalle>> {
    if (Capacitor.isNativePlatform()) {
      return this.nativeRequest<SpResponse<FichaAlumnoDetalle>>('GET', `${this.baseUrl}/mis-alumnos/${idmatricula}`);
    }

    return this.http.get<SpResponse<FichaAlumnoDetalle>>(`${this.baseUrl}/mis-alumnos/${idmatricula}`);
  }

  guardarMiAlumnoFicha(
    idmatricula: number,
    request: Record<string, unknown>
  ): Observable<SpResponse<{ idmatricula: number }>> {
    if (Capacitor.isNativePlatform()) {
      return this.nativeRequest<SpResponse<{ idmatricula: number }>>(
        'PUT',
        `${this.baseUrl}/mis-alumnos/${idmatricula}/ficha`,
        request
      );
    }

    return this.http.put<SpResponse<{ idmatricula: number }>>(
      `${this.baseUrl}/mis-alumnos/${idmatricula}/ficha`,
      request
    );
  }

  registrarDocumento(
    idmatricula: number,
    request: RegistrarDocumentoAlumnoRequest
  ): Observable<SpResponse<{ idalumnofichadocumento: number }>> {
    if (Capacitor.isNativePlatform()) {
      return this.nativeRequest<SpResponse<{ idalumnofichadocumento: number }>>(
        'POST',
        `${this.baseUrl}/mis-alumnos/${idmatricula}/documentos`,
        request
      );
    }

    return this.http.post<SpResponse<{ idalumnofichadocumento: number }>>(
      `${this.baseUrl}/mis-alumnos/${idmatricula}/documentos`,
      request
    );
  }

  eliminarDocumento(
    idmatricula: number,
    idalumnofichadocumento: number
  ): Observable<SpResponse<{ idalumnofichadocumento: number }>> {
    if (Capacitor.isNativePlatform()) {
      return this.nativeRequest<SpResponse<{ idalumnofichadocumento: number }>>(
        'DELETE',
        `${this.baseUrl}/mis-alumnos/${idmatricula}/documentos/${idalumnofichadocumento}`
      );
    }

    return this.http.delete<SpResponse<{ idalumnofichadocumento: number }>>(
      `${this.baseUrl}/mis-alumnos/${idmatricula}/documentos/${idalumnofichadocumento}`
    );
  }

  responderAutorizacion(
    idmatricula: number,
    request: ResponderAutorizacionAlumnoRequest
  ): Observable<SpResponse<{ idalumnofichaautorizacion: number; respuesta: string }>> {
    if (Capacitor.isNativePlatform()) {
      return this.nativeRequest<SpResponse<{ idalumnofichaautorizacion: number; respuesta: string }>>(
        'POST',
        `${this.baseUrl}/mis-alumnos/${idmatricula}/autorizaciones/respuestas`,
        request
      );
    }

    return this.http.post<SpResponse<{ idalumnofichaautorizacion: number; respuesta: string }>>(
      `${this.baseUrl}/mis-alumnos/${idmatricula}/autorizaciones/respuestas`,
      request
    );
  }

  documentoArchivoUrl(idalumnofichadocumento: number): string {
    return `${this.baseUrl}/mis-alumnos/documentos/${idalumnofichadocumento}/archivo`;
  }

  consultarDocumentoArchivo(idalumnofichadocumento: number, contentType?: string | null): Observable<Blob> {
    const url = this.documentoArchivoUrl(idalumnofichadocumento);
    const mimeType = contentType || 'application/octet-stream';

    console.log('[FichaAlumnoService] consultarDocumentoArchivo request', {
      idalumnofichadocumento,
      url,
      mimeType,
      native: Capacitor.isNativePlatform(),
    });

    if (Capacitor.isNativePlatform()) {
      const headers: HttpHeaders = {
        Accept: mimeType,
      };
      const token = this.authService.getToken();

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      return from(CapacitorHttp.request({
        method: 'GET',
        url,
        headers,
        responseType: 'blob',
        connectTimeout: 20000,
        readTimeout: 60000,
      })).pipe(
        map((response) => this.mapNativeBlobResponse(response, mimeType, 'documento-alumno'))
      );
    }

    return this.http.get(url, { responseType: 'blob' });
  }

  autorizacionPdfUrl(idalumnofichaautorizacion: number): string {
    return `${this.baseUrl}/mis-alumnos/autorizaciones/${idalumnofichaautorizacion}/pdf`;
  }

  autorizacionAdjuntoUrl(iddocumentodigitaladjunto: number): string {
    return `${this.baseUrl}/mis-alumnos/autorizaciones/adjuntos/${iddocumentodigitaladjunto}/archivo`;
  }

  consultarAutorizacionPdf(idalumnofichaautorizacion: number): Observable<Blob> {
    const url = this.autorizacionPdfUrl(idalumnofichaautorizacion);

    if (Capacitor.isNativePlatform()) {
      const headers: HttpHeaders = {
        Accept: 'application/pdf',
      };
      const token = this.authService.getToken();

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      return from(CapacitorHttp.request({
        method: 'GET',
        url,
        headers,
        responseType: 'blob',
        connectTimeout: 20000,
        readTimeout: 60000,
      })).pipe(
        map((response) => this.mapNativeBlobResponse(response, 'application/pdf', 'autorizacion-pdf'))
      );
    }

    return this.http.get(url, { responseType: 'blob' });
  }

  consultarAutorizacionAdjunto(iddocumentodigitaladjunto: number, contentType?: string | null): Observable<Blob> {
    const url = this.autorizacionAdjuntoUrl(iddocumentodigitaladjunto);
    const mimeType = contentType || 'application/octet-stream';

    if (Capacitor.isNativePlatform()) {
      const headers: HttpHeaders = {
        Accept: mimeType,
      };
      const token = this.authService.getToken();

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      return from(CapacitorHttp.request({
        method: 'GET',
        url,
        headers,
        responseType: 'blob',
        connectTimeout: 20000,
        readTimeout: 60000,
      })).pipe(
        map((response) => this.mapNativeBlobResponse(response, mimeType, 'autorizacion-adjunto'))
      );
    }

    return this.http.get(url, { responseType: 'blob' });
  }

  private nativeRequest<T>(method: string, url: string, data?: unknown): Observable<T> {
    const headers: HttpHeaders = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const token = this.authService.getToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return from(CapacitorHttp.request({
      method,
      url,
      data,
      headers,
      responseType: 'json',
      connectTimeout: 20000,
      readTimeout: 60000,
    })).pipe(
      map((response) => this.mapNativeResponse<T>(response))
    );
  }

  private mapNativeResponse<T>(response: HttpResponse): T {
    if (response.status >= 200 && response.status < 300) {
      return response.data as T;
    }

    const responseMessage = response.status === 403 && this.authService.isSupportSession()
      ? 'El acceso de soporte es exclusivamente de consulta. No se permite guardar ni modificar informacion del familiar.'
      : typeof response.data?.message === 'string' && response.data.message.trim()
        ? response.data.message
        : `GpsApi devolvio HTTP ${response.status} sin detalle.`;
    const error = new Error(responseMessage);
    Object.assign(error, {
      status: response.status,
      error: typeof response.data === 'string' && !response.data.trim() ? null : response.data,
      url: response.url,
    });
    throw error;
  }

  private mapNativeBlobResponse(response: HttpResponse, contentType: string, context: string): Blob {
    console.log('[FichaAlumnoService] blob response', {
      context,
      status: response.status,
      url: response.url,
      headers: response.headers,
      dataType: typeof response.data,
      isBlob: response.data instanceof Blob,
      dataLength: typeof response.data === 'string' ? response.data.length : undefined,
    });

    if (response.status < 200 || response.status >= 300) {
      const responseMessage = response.status === 403 && this.authService.isSupportSession()
        ? 'El acceso de soporte es exclusivamente de consulta. No se permite guardar ni modificar informacion del familiar.'
        : typeof response.data?.message === 'string' && response.data.message.trim()
          ? response.data.message
          : `GpsApi devolvio HTTP ${response.status} sin detalle.`;
      console.error('[FichaAlumnoService] blob error response', {
        context,
        status: response.status,
        url: response.url,
        data: response.data,
      });
      const error = new Error(responseMessage);
      Object.assign(error, {
        status: response.status,
        error: typeof response.data === 'string' && !response.data.trim() ? null : response.data,
        url: response.url,
      });
      throw error;
    }

    if (response.data instanceof Blob) {
      console.log('[FichaAlumnoService] blob mapped', {
        context,
        size: response.data.size,
        type: response.data.type,
      });
      return response.data;
    }

    const base64 = typeof response.data === 'string'
      ? response.data
      : String(response.data ?? '');
    const normalizedBase64 = base64.replace(/\s/g, '');
    const byteCharacters = atob(normalizedBase64);
    const byteNumbers = Array.from(byteCharacters, (character) => character.charCodeAt(0));
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: contentType });
    console.log('[FichaAlumnoService] blob mapped from base64', {
      context,
      size: blob.size,
      type: blob.type,
    });
    return blob;
  }
}
