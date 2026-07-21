export interface SpResponse<T> {
  result: T | null;
  message?: string | null;
  codeNumber?: number | null;
}

export interface PuntoRegistroVisitante {
  idpuntoregistrovisitante: number;
  idorg: number;
  idua?: number | null;
  unidadAdministrativa?: string | null;
  idpuerta?: number | null;
  puerta?: string | null;
  codigo?: string | null;
  descripcion?: string | null;
  aviso?: string | null;
  organizacion?: string | null;
  logoorg?: string | null;
  latitud?: number | null;
  longitud?: number | null;
}

export interface RegistrarVisitanteProveedorRequest {
  idorg?: number | null;
  tipoVisitante: 'VISITANTE' | 'PROVEEDOR';
  nombre: string;
  apellidos?: string | null;
  empresa?: string | null;
  cel?: string | null;
  emailContacto?: string | null;
  idareavisita?: number | null;
  areaVisita?: string | null;
  personaVisita?: string | null;
  motivoVisita?: string | null;
  foto?: string | null;
}

export interface VisitanteProveedorPase {
  idvisitaregistro: number;
  idorg: number;
  idpuntoregistrovisitante?: number | null;
  tipoVisitante?: string | null;
  visitante?: string | null;
  nombre?: string | null;
  apellidos?: string | null;
  empresa?: string | null;
  cel?: string | null;
  emailContacto?: string | null;
  areaVisita?: string | null;
  personaVisita?: string | null;
  motivoVisita?: string | null;
  codigoPase: string;
  estatus?: string | null;
  fechaRegistro?: string | null;
  fechaPreregistro?: string | null;
  punto?: string | null;
  organizacion?: string | null;
  leyendaIdentificacion?: string | null;
  foto?: string | null;
  codigoGafete?: string | null;
  etiquetaGafete?: string | null;
  idtagGafete?: number | null;
  idperfil?: number | null;
  fechaEntrada?: string | null;
  fechaSalida?: string | null;
  puedeAutorizar?: boolean | null;
}

export interface AutorizarEntradaVisitanteRequest {
  idorg: number;
  idtagGafete?: number | null;
  codigoGafete?: string | null;
  fechaHoraEvento?: string | null;
  idmedioIdentificacion?: number | null;
  idpuerta?: number | null;
  iddispositivo?: number | null;
  comentarios?: string | null;
}

export interface RegistrarSalidaVisitanteRequest {
  idorg: number;
  idtagGafete?: number | null;
  codigoGafete?: string | null;
  fechaHoraEvento?: string | null;
  idmedioIdentificacion?: number | null;
  idpuerta?: number | null;
  iddispositivo?: number | null;
  comentarios?: string | null;
}
