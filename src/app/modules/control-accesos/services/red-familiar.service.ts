import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AplicarCodigoCompartirRequest,
  AplicarCodigoCompartirResponse,
  AutoFamiliar,
  CodigoCompartir,
  GenerarPaseInvitadoExternoRequest,
  GenerarCodigoCompartirRequest,
  GuardarAlumnoAutorizacionRequest,
  GuardarAutoFamiliarRequest,
  GuardarInvitadoExternoProvisionalRequest,
  GuardarMiembroFamiliarRequest,
  MiembroFamiliar,
  RedFamiliarCatalogos,
  RedFamiliarRow,
  RetirarAlumnoCompartidoResponse,
  RevocarAlumnoCompartidoFamiliaResponse,
  SpResponse,
} from '../models/red-familiar.model';

@Injectable({
  providedIn: 'root',
})
export class RedFamiliarService {
  private readonly apiUrl = Capacitor.isNativePlatform()
    ? environment.androidApiUrl
    : environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/control-accesos`;

  constructor(private readonly http: HttpClient) {}

  consultarMiRed(idorg: number): Observable<RedFamiliarRow[]> {
    const params = new HttpParams().set('idorg', String(idorg));

    return this.http.get<SpResponse<RedFamiliarRow[]>>(`${this.baseUrl}/familiares/alumnos-autorizados`, { params }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result ?? [];
      })
    );
  }


  consultarAlumnosNucleo(idorg: number): Observable<RedFamiliarRow[]> {
    const params = new HttpParams().set('idorg', String(idorg));

    return this.http.get<SpResponse<{ alumnos?: RedFamiliarRow[] }>>(`${this.baseUrl}/familiares/alumnos-nucleo`, { params }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result?.alumnos ?? [];
      })
    );
  }
  consultarCatalogos(): Observable<RedFamiliarCatalogos> {
    return this.http.get<SpResponse<RedFamiliarCatalogos>>(`${this.baseUrl}/red-familiar/catalogos`).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result ?? {};
      })
    );
  }

  crearMiembro(idfamilia: number, request: GuardarMiembroFamiliarRequest): Observable<MiembroFamiliar | null> {
    return this.http.post<SpResponse<MiembroFamiliar>>(`${this.baseUrl}/familias/${idfamilia}/miembros`, request).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result;
      })
    );
  }

  crearInvitadoExternoProvisional(
    idfamilia: number,
    request: GuardarInvitadoExternoProvisionalRequest
  ): Observable<MiembroFamiliar | null> {
    return this.http.post<SpResponse<MiembroFamiliar>>(`${this.baseUrl}/familias/${idfamilia}/externos`, request).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result;
      })
    );
  }

  generarPaseInvitadoExterno(
    idfamilia: number,
    idfamiliamiembro: number,
    request: GenerarPaseInvitadoExternoRequest
  ): Observable<CodigoCompartir> {
    return this.http.post<SpResponse<CodigoCompartir>>(
      `${this.baseUrl}/familias/${idfamilia}/externos/${idfamiliamiembro}/pases`,
      request
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as CodigoCompartir;
      })
    );
  }

  actualizarMiembro(
    idfamilia: number,
    idfamiliamiembro: number,
    request: GuardarMiembroFamiliarRequest
  ): Observable<MiembroFamiliar | null> {
    return this.http.put<SpResponse<MiembroFamiliar>>(
      `${this.baseUrl}/familias/${idfamilia}/miembros/${idfamiliamiembro}`,
      request
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result;
      })
    );
  }

  guardarFotoCredencial(request: {
    idorg: number;
    idperfil: number;
    idusrbtMiembro?: number | null;
    idmatricula?: number | null;
    fotoBase64: string;
    fotoContentType?: string | null;
    origen?: string | null;
    procesamientoEstado?: string | null;
    procesamientoMetodo?: string | null;
    sitvalidada?: boolean | null;
  }): Observable<{ fotoUrl?: string | null } | null> {
    return this.http.post<SpResponse<{ fotoUrl?: string | null }>>(`${this.baseUrl}/credencial-fotos`, {
      ...request,
      origen: request.origen ?? 'APPSECLIFE',
      fotoContentType: request.fotoContentType ?? 'image/jpeg',
      procesamientoEstado: request.procesamientoEstado ?? 'SIN_PROCESAR',
      procesamientoMetodo: request.procesamientoMetodo ?? 'RED_FAMILIAR_APP',
      sitvalidada: request.sitvalidada ?? false
    }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result;
      })
    );
  }

  crearAuto(idfamilia: number, request: GuardarAutoFamiliarRequest): Observable<AutoFamiliar | null> {
    return this.http.post<SpResponse<AutoFamiliar>>(`${this.baseUrl}/familias/${idfamilia}/autos`, request).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result;
      })
    );
  }

  crearAlumnoAutorizacion(idfamilia: number, request: GuardarAlumnoAutorizacionRequest): Observable<RedFamiliarRow | null> {
    return this.http.post<SpResponse<RedFamiliarRow>>(`${this.baseUrl}/familias/${idfamilia}/alumnos-autorizados`, request).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result;
      })
    );
  }

  cambiarEstadoMiembro(idfamiliamiembro: number, idorg: number, sitactivo: boolean): Observable<MiembroFamiliar | null> {
    return this.http.put<SpResponse<MiembroFamiliar>>(`${this.baseUrl}/miembros/${idfamiliamiembro}/activo`, {
      idorg,
      sitactivo,
    }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result;
      })
    );
  }

  actualizarBloqueoTag(idtag: number, idorg: number, sitbloqueo: boolean, idsittag?: number | null): Observable<unknown> {
    return this.http.put<SpResponse<unknown>>(`${this.baseUrl}/tags/${idtag}/tramite`, {
      idorg,
      idsittag,
      sitbloqueo,
    }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result;
      })
    );
  }

  cambiarEstadoAuto(idautofamiliar: number, idorg: number, sitactivo: boolean): Observable<AutoFamiliar | null> {
    return this.http.put<SpResponse<AutoFamiliar>>(`${this.baseUrl}/autos/${idautofamiliar}/activo`, {
      idorg,
      sitactivo,
    }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result;
      })
    );
  }

  cambiarEstadoAlumno(idalumnoautorizacion: number, idorg: number, sitactivo: boolean): Observable<unknown> {
    return this.http.put<SpResponse<unknown>>(`${this.baseUrl}/alumnos-autorizados/${idalumnoautorizacion}/activo`, {
      idorg,
      sitactivo,
    }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result;
      })
    );
  }

  generarCodigoCompartir(request: GenerarCodigoCompartirRequest): Observable<CodigoCompartir> {
    return this.http.post<SpResponse<CodigoCompartir>>(`${this.baseUrl}/red-familiar/codigos`, request).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as CodigoCompartir;
      })
    );
  }

  listarCodigosCompartir(idorg: number, idfamilia?: number | null): Observable<CodigoCompartir[]> {
    let params = new HttpParams().set('idorg', String(idorg));

    if (idfamilia) {
      params = params.set('idfamilia', String(idfamilia));
    }

    return this.http.get<SpResponse<CodigoCompartir[]>>(`${this.baseUrl}/red-familiar/codigos`, { params }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result ?? [];
      })
    );
  }

  consultarCodigoCompartir(codigo: string, idorg: number): Observable<CodigoCompartir> {
    const params = new HttpParams().set('idorg', String(idorg));

    return this.http.get<SpResponse<CodigoCompartir>>(`${this.baseUrl}/red-familiar/codigos/${encodeURIComponent(codigo)}`, { params }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as CodigoCompartir;
      })
    );
  }

  aplicarCodigoCompartir(codigo: string, request: AplicarCodigoCompartirRequest): Observable<AplicarCodigoCompartirResponse> {
    return this.http.post<SpResponse<AplicarCodigoCompartirResponse>>(
      `${this.baseUrl}/red-familiar/codigos/${encodeURIComponent(codigo)}/aplicar`,
      request
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as AplicarCodigoCompartirResponse;
      })
    );
  }

  retirarAlumnoCompartido(
    idmatricula: number,
    idorg: number,
    idfamilia: number,
    idfamiliamiembroDestino: number
  ): Observable<RetirarAlumnoCompartidoResponse> {
    return this.http.put<SpResponse<RetirarAlumnoCompartidoResponse>>(
      `${this.baseUrl}/red-familiar/alumnos-compartidos/${idmatricula}/retirar`,
      { idorg, idfamilia, idfamiliamiembroDestino }
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as RetirarAlumnoCompartidoResponse;
      })
    );
  }

  revocarAlumnoCompartidoFamilia(
    idmatricula: number,
    idfamiliaDestino: number,
    idorg: number,
    idfamiliaOrigen: number
  ): Observable<RevocarAlumnoCompartidoFamiliaResponse> {
    return this.http.put<SpResponse<RevocarAlumnoCompartidoFamiliaResponse>>(
      `${this.baseUrl}/red-familiar/alumnos-compartidos/${idmatricula}/familias/${idfamiliaDestino}/revocar`,
      { idorg, idfamiliaOrigen }
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as RevocarAlumnoCompartidoFamiliaResponse;
      })
    );
  }

  cancelarCodigoCompartir(codigo: string, idorg: number, idfamilia: number): Observable<CodigoCompartir> {
    return this.http.delete<SpResponse<CodigoCompartir>>(
      `${this.baseUrl}/red-familiar/codigos/${encodeURIComponent(codigo)}`,
      { body: { idorg, idfamilia } }
    ).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as CodigoCompartir;
      })
    );
  }

  private assertSuccess<T>(response: SpResponse<T>): void {
    if (response.codeNumber && response.codeNumber !== 200) {
      throw new Error(response.message || 'No fue posible completar la operacion.');
    }
  }
}
