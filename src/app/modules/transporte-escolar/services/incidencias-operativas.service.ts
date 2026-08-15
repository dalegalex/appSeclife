import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SpResponse } from '../models/conductor-ruta.model';

export type TipoIncidenciaOperativa =
  | 'RETRASO'
  | 'TRAFICO_CORTE'
  | 'FALLA_MECANICA'
  | 'PERCANCE'
  | 'CAMBIO_RUTA'
  | 'EMERGENCIA_MEDICA'
  | 'OTRO';

export interface PoliticaIncidenciasOperativas {
  idruta: number;
  permiteIncidenciasPush: boolean;
  permiteMensajesPredeterminados: boolean;
  permiteTextoLibreIncidencia: boolean;
  textoLibreRequiereAutorizacion: boolean;
  permiteConductorIncidencia: boolean;
  permiteAsistenteIncidencia: boolean;
  rolOperador: 'CONDUCTOR' | 'ASISTENTE' | null;
  puedeReportar: boolean;
}

export interface IncidenciaOperativaResultado {
  idincidenciatransporte: number;
  estatus: 'PENDIENTE_AUTORIZACION' | 'ENVIADA' | 'SIN_DESTINATARIOS';
  tipoIncidente: TipoIncidenciaOperativa;
  severidad: string;
  mensaje: string;
  alumnosDestinatarios: number;
}

@Injectable({ providedIn: 'root' })
export class IncidenciasOperativasService {
  private readonly baseUrl = `${environment.apiUrl}/transporte-escolar`;

  constructor(private readonly http: HttpClient) {}

  consultarPolitica(idruta: number): Observable<SpResponse<PoliticaIncidenciasOperativas>> {
    return this.http.get<SpResponse<PoliticaIncidenciasOperativas>>(`${this.baseUrl}/rutas/${idruta}/incidencias/politica`);
  }

  reportar(idrecorrido: number, request: {
    tipoIncidente: TipoIncidenciaOperativa;
    mensaje: string | null;
    esTextoLibre: boolean;
    aceptoResponsabilidad: boolean;
    latitud: number | null;
    longitud: number | null;
  }): Observable<SpResponse<IncidenciaOperativaResultado>> {
    return this.http.post<SpResponse<IncidenciaOperativaResultado>>(`${this.baseUrl}/recorridos/${idrecorrido}/incidencias`, {
      ...request,
      llaveIdempotente: crypto.randomUUID()
    });
  }
}
