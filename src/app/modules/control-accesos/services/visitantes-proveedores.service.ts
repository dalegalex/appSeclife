import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AutorizarEntradaVisitanteRequest,
  PuntoRegistroVisitante,
  RegistrarSalidaVisitanteRequest,
  RegistrarVisitanteProveedorRequest,
  SpResponse,
  VisitanteProveedorPase,
} from '../models/visitantes-proveedores.model';

@Injectable({
  providedIn: 'root',
})
export class VisitantesProveedoresService {
  private readonly apiUrl = Capacitor.isNativePlatform()
    ? environment.androidApiUrl
    : environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/control-accesos/visitantes-proveedores`;

  constructor(private readonly http: HttpClient) {}

  consultarPunto(codigo: string, idorg?: number | null): Observable<PuntoRegistroVisitante> {
    let params = new HttpParams();

    if (idorg) {
      params = params.set('idorg', String(idorg));
    }

    return this.http.get<SpResponse<PuntoRegistroVisitante>>(`${this.baseUrl}/puntos/${encodeURIComponent(codigo)}`, { params }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as PuntoRegistroVisitante;
      })
    );
  }

  registrarPreregistro(
    idpuntoregistrovisitante: number,
    request: RegistrarVisitanteProveedorRequest
  ): Observable<VisitanteProveedorPase> {
    return this.http.post<SpResponse<VisitanteProveedorPase>>(
      `${this.baseUrl}/puntos/${idpuntoregistrovisitante}/registros`,
      request
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as VisitanteProveedorPase;
      })
    );
  }

  resolverPase(codigoPase: string, idorg: number): Observable<VisitanteProveedorPase> {
    const params = new HttpParams().set('idorg', String(idorg));

    return this.http.get<SpResponse<VisitanteProveedorPase>>(
      `${this.baseUrl}/pases/${encodeURIComponent(codigoPase)}`,
      { params }
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as VisitanteProveedorPase;
      })
    );
  }

  validarGafete(codigoGafete: string, idorg: number): Observable<VisitanteProveedorPase> {
    const params = new HttpParams().set('idorg', String(idorg));

    return this.http.get<SpResponse<VisitanteProveedorPase>>(
      `${this.baseUrl}/gafetes/${encodeURIComponent(codigoGafete)}`,
      { params }
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as VisitanteProveedorPase;
      })
    );
  }

  autorizarEntrada(
    idvisitaregistro: number,
    request: AutorizarEntradaVisitanteRequest
  ): Observable<VisitanteProveedorPase> {
    return this.http.post<SpResponse<VisitanteProveedorPase>>(
      `${this.baseUrl}/registros/${idvisitaregistro}/entrada`,
      request
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as VisitanteProveedorPase;
      })
    );
  }

  registrarSalida(request: RegistrarSalidaVisitanteRequest): Observable<VisitanteProveedorPase> {
    return this.http.post<SpResponse<VisitanteProveedorPase>>(
      `${this.baseUrl}/gafetes/salida`,
      request
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as VisitanteProveedorPase;
      })
    );
  }

  private assertSuccess<T>(response: SpResponse<T>): void {
    if (response.codeNumber && response.codeNumber !== 200) {
      throw new Error(response.message || 'No fue posible completar la operacion.');
    }
  }
}
