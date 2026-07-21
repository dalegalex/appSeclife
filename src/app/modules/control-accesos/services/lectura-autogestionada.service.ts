import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AutogestionCatalogos,
  AutogestionAsistenciaLectura,
  AutogestionAsistenciaRegistro,
  AutogestionEventoLectura,
  AutogestionEventoRegistro,
  AutogestionSesion,
  AbrirSesionAutogestionRequest,
  RegistrarAutogestionAsistenciaRequest,
  RegistrarAutogestionEventoRequest,
  ResolverAutogestionAsistenciaParams,
  ResolverAutogestionEventoParams,
  SpResponse,
} from '../models/lectura-autogestionada.model';

@Injectable({
  providedIn: 'root',
})
export class LecturaAutogestionadaService {
  private readonly apiUrl = Capacitor.isNativePlatform()
    ? environment.androidApiUrl
    : environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/control-accesos/autogestion`;

  constructor(private readonly http: HttpClient) {}

  consultarCatalogos(idorg: number): Observable<AutogestionCatalogos> {
    const params = new HttpParams()
      .set('idorg', String(idorg))
      .set('sitactivo', 'true');

    return this.http.get<SpResponse<AutogestionCatalogos>>(`${this.baseUrl}/catalogos`, { params }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result ?? {};
      })
    );
  }

  resolverEvento(params: ResolverAutogestionEventoParams): Observable<AutogestionEventoLectura> {
    let httpParams = new HttpParams()
      .set('idorg', String(params.idorg))
      .set('ideventoacceso', String(params.ideventoacceso));

    if (params.codigo) {
      httpParams = httpParams.set('codigo', params.codigo);
    }

    if (params.idtag) {
      httpParams = httpParams.set('idtag', String(params.idtag));
    }

    if (params.idsesionautogestion) {
      httpParams = httpParams.set('idsesionautogestion', String(params.idsesionautogestion));
    }

    if (params.fechaHoraEvento) {
      httpParams = httpParams.set('fechaHoraEvento', params.fechaHoraEvento);
    }

    return this.http.get<SpResponse<AutogestionEventoLectura>>(`${this.baseUrl}/eventos/lectura`, { params: httpParams }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as AutogestionEventoLectura;
      })
    );
  }

  registrarEvento(request: RegistrarAutogestionEventoRequest): Observable<AutogestionEventoRegistro> {
    return this.http.post<SpResponse<AutogestionEventoRegistro>>(`${this.baseUrl}/eventos/lectura`, request).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as AutogestionEventoRegistro;
      })
    );
  }

  abrirSesion(request: AbrirSesionAutogestionRequest): Observable<AutogestionSesion> {
    return this.http.post<SpResponse<AutogestionSesion>>(`${this.baseUrl}/sesiones`, request).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as AutogestionSesion;
      })
    );
  }

  cerrarSesion(idorg: number, idsesionautogestion: number, pinOperador: string): Observable<{ idsesionautogestion: number; estatus: string }> {
    return this.http.post<SpResponse<{ idsesionautogestion: number; estatus: string }>>(
      `${this.baseUrl}/sesiones/${idsesionautogestion}/cerrar`,
      { idorg, pinOperador }
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as { idsesionautogestion: number; estatus: string };
      })
    );
  }

  resolverAsistencia(params: ResolverAutogestionAsistenciaParams): Observable<AutogestionAsistenciaLectura> {
    let httpParams = new HttpParams()
      .set('idorg', String(params.idorg))
      .set('idsesionautogestion', String(params.idsesionautogestion));

    if (params.codigo) {
      httpParams = httpParams.set('codigo', params.codigo);
    }

    if (params.idtag) {
      httpParams = httpParams.set('idtag', String(params.idtag));
    }

    if (params.fechaHoraEvento) {
      httpParams = httpParams.set('fechaHoraEvento', params.fechaHoraEvento);
    }

    return this.http.get<SpResponse<AutogestionAsistenciaLectura>>(`${this.baseUrl}/asistencia/lectura`, { params: httpParams }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as AutogestionAsistenciaLectura;
      })
    );
  }

  registrarAsistencia(request: RegistrarAutogestionAsistenciaRequest): Observable<AutogestionAsistenciaRegistro> {
    return this.http.post<SpResponse<AutogestionAsistenciaRegistro>>(`${this.baseUrl}/asistencia/lectura`, request).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as AutogestionAsistenciaRegistro;
      })
    );
  }

  private assertSuccess<T>(response: SpResponse<T>): void {
    if (response.codeNumber && response.codeNumber !== 200) {
      throw new Error(response.message || 'No fue posible completar la operacion.');
    }
  }
}
