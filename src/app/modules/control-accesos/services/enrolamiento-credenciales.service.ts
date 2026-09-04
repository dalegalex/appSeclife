import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  FotoCredencialResult,
  FotoEnrolamientoRequest,
  PerfilEnrolamiento,
  RotarTagEnrolamientoRequest,
  RotarTagEnrolamientoResult,
  SpResponse,
  SujetoEnrolamiento,
} from '../models/enrolamiento-credenciales.model';

@Injectable({ providedIn: 'root' })
export class EnrolamientoCredencialesService {
  private readonly apiUrl = Capacitor.isNativePlatform()
    ? environment.androidApiUrl
    : environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/control-accesos/enrolamiento`;

  constructor(private readonly http: HttpClient) {}

  consultarSujetos(params: {
    idorg: number;
    idperfil: PerfilEnrolamiento;
    searchText?: string;
    topi: number;
  }): Observable<SujetoEnrolamiento[]> {
    let query = new HttpParams()
      .set('idorg', String(params.idorg))
      .set('idperfil', String(params.idperfil))
      .set('topi', String(params.topi));

    if (params.searchText?.trim()) {
      query = query.set('searchText', params.searchText.trim());
    }

    return this.http.get<SpResponse<SujetoEnrolamiento[]>>(`${this.baseUrl}/sujetos`, { params: query }).pipe(
      map(response => this.unwrap(response) ?? [])
    );
  }

  consultarFoto(params: {
    idorg: number;
    idperfil: PerfilEnrolamiento;
    idusrbtMiembro?: number | null;
    idmatricula?: number | null;
    subjectKey: string;
  }): Observable<FotoCredencialResult | null> {
    let query = new HttpParams()
      .set('idorg', String(params.idorg))
      .set('idperfil', String(params.idperfil))
      .set('subjectKey', params.subjectKey)
      .set('mostrarFoto', 'true');

    if (params.idusrbtMiembro) query = query.set('idusrbtMiembro', String(params.idusrbtMiembro));
    if (params.idmatricula) query = query.set('idmatricula', String(params.idmatricula));

    return this.http.get<SpResponse<FotoCredencialResult>>(`${this.baseUrl}/fotos`, { params: query }).pipe(
      map(response => this.unwrap(response))
    );
  }

  guardarFoto(request: FotoEnrolamientoRequest): Observable<unknown> {
    return this.http.post<SpResponse<unknown>>(`${this.baseUrl}/fotos`, request).pipe(
      map(response => this.unwrap(response))
    );
  }

  rotarTag(request: RotarTagEnrolamientoRequest): Observable<RotarTagEnrolamientoResult> {
    return this.http.post<SpResponse<RotarTagEnrolamientoResult>>(`${this.baseUrl}/tag-nfc`, request).pipe(
      map(response => this.unwrap(response) as RotarTagEnrolamientoResult)
    );
  }

  private unwrap<T>(response: SpResponse<T>): T | null {
    if (response.codeNumber && response.codeNumber !== 200) {
      throw new Error(response.message || 'No fue posible completar la operacion.');
    }
    return response.result;
  }
}
