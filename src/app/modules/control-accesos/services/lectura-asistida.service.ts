import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  LecturaAsistidaRegistroResponse,
  LecturaAsistidaResponse,
  RegistrarLecturaAsistidaRequest,
  UnidadAdministrativaLectura,
  ResolverLecturaAsistidaParams,
  SpResponse,
} from '../models/lectura-asistida.model';

@Injectable({
  providedIn: 'root',
})
export class LecturaAsistidaService {
  private readonly apiUrl = Capacitor.isNativePlatform()
    ? environment.androidApiUrl
    : environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/control-accesos/lectura-asistida`;

  constructor(private readonly http: HttpClient) {}

  resolverLectura(params: ResolverLecturaAsistidaParams): Observable<LecturaAsistidaResponse> {
    let httpParams = new HttpParams()
      .set('idorg', String(params.idorg))
      .set('sentido', params.sentido);

    if (params.codigo) {
      httpParams = httpParams.set('codigo', params.codigo);
    }

    if (params.idtag) {
      httpParams = httpParams.set('idtag', String(params.idtag));
    }

    if (params.mostrarFoto !== null && params.mostrarFoto !== undefined) {
      httpParams = httpParams.set('mostrarFoto', String(params.mostrarFoto));
    }

    if (params.fechaHoraEvento) {
      httpParams = httpParams.set('fechaHoraEvento', params.fechaHoraEvento);
    }

    for (const idua of params.iduas ?? []) {
      httpParams = httpParams.append('iduas', String(idua));
    }

    return this.http.get<SpResponse<LecturaAsistidaResponse>>(this.baseUrl, { params: httpParams }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as LecturaAsistidaResponse;
      })
    );
  }

  consultarUnidadesAdministrativas(idorg: number): Observable<UnidadAdministrativaLectura[]> {
    const params = new HttpParams().set('idorg', String(idorg));

    return this.http.get<SpResponse<{ unidadesAdministrativas?: UnidadAdministrativaLectura[] }>>(
      `${this.apiUrl}/control-accesos/red-familiar/catalogos`,
      { params }
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result?.unidadesAdministrativas ?? [];
      })
    );
  }
  registrarLectura(request: RegistrarLecturaAsistidaRequest): Observable<LecturaAsistidaRegistroResponse> {
    return this.http.post<SpResponse<LecturaAsistidaRegistroResponse>>(this.baseUrl, request).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as LecturaAsistidaRegistroResponse;
      })
    );
  }

  private assertSuccess<T>(response: SpResponse<T>): void {
    if (response.codeNumber && response.codeNumber !== 200) {
      throw new Error(response.message || 'No fue posible completar la operacion.');
    }
  }
}
