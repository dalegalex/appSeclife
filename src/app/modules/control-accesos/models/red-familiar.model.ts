export interface SpResponse<T> {
  result: T | null;
  message?: string | null;
  codeNumber?: number | null;
}

export interface RedFamiliarRow {
  idalumnoautorizacion?: number | null;
  idorg?: number | null;
  idmatricula?: number | null;
  matricula?: string | null;
  curp?: string | null;
  gradoGrupo?: string | null;
  alumno?: string | null;
  idfamilia?: number | null;
  nombreFamilia?: string | null;
  idusrbtMaster?: number | null;
  idfamiliamiembro?: number | null;
  idusrbt?: number | null;
  familiar?: string | null;
  idparentesco?: number | null;
  parentesco?: string | null;
  tipoRelacion?: string | null;
  tipoRelacionDescripcion?: string | null;
  puedeRecoger?: boolean | null;
  puedeVerAcademico?: boolean | null;
  requiereValidacionDocumento?: boolean | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  compartidos?: AlumnoCompartido[];
  autos?: AutoFamiliar[];
  miembros?: MiembroFamiliar[];
}

export interface AlumnoCompartido {
  idalumnoautorizacion: number;
  idfamiliaDestino?: number | null;
  familiaDestino?: string | null;
  idfamiliamiembroDestino?: number | null;
  familiarDestino?: string | null;
  tipoRelacion?: string | null;
  tipoRelacionDescripcion?: string | null;
  origen?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  puedeRecoger?: boolean | null;
  requiereValidacionDocumento?: boolean | null;
}

export interface MiembroFamiliar {
  idfamiliamiembro: number;
  idfamilia?: number | null;
  idusrbt?: number | null;
  idinvitadoexterno?: number | null;
  familiar: string;
  nombre?: string | null;
  apellidos?: string | null;
  foto?: string | null;
  cel?: string | null;
  emailContacto?: string | null;
  idtag?: number | null;
  codigo?: string | null;
  idsittag?: number | null;
  sittipotag?: boolean | null;
  sitbloqueo?: boolean | null;
  idparentesco?: number | null;
  parentesco?: string | null;
  esMaster?: boolean | null;
  esExterno?: boolean | null;
  requiereValidacionDocumento?: boolean | null;
  leyendaIdentificacion?: string | null;
  puedeRecoger?: boolean | null;
  puedeAdministrar?: boolean | null;
  sitMiembroSilencioso?: boolean | null;
  sitactivo?: boolean | null;
}

export interface AlumnoFamiliar {
  idalumnoautorizacion: number;
  idmatricula: number;
  matricula?: string | null;
  curp?: string | null;
  gradoGrupo?: string | null;
  alumno: string;
  tipoRelacion?: string | null;
  tipoRelacionDescripcion?: string | null;
  puedeRecoger?: boolean | null;
  puedeVerAcademico?: boolean | null;
  requiereValidacionDocumento?: boolean | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  compartidos?: AlumnoCompartido[];
}

export interface AutoFamiliar {
  idautofamiliar: number;
  idfamilia?: number | null;
  idfamiliamiembro?: number | null;
  placas?: string | null;
  marca?: string | null;
  modelo?: string | null;
  color?: string | null;
  observaciones?: string | null;
  sitactivo?: boolean | null;
}

export interface RedFamiliarCatalogos {
  parentescos?: RedFamiliarCatalogo[];
  tiposRelacion?: RedFamiliarCatalogo[];
}

export interface RedFamiliarCatalogo {
  idparentesco?: number | null;
  idtiporelacionalumnousr?: number | null;
  descripcion?: string | null;
  nombre?: string | null;
}

export interface GuardarMiembroFamiliarRequest {
  idorg: number;
  idusrbtMiembro?: number | null;
  nombre: string;
  apellidos: string;
  cel?: string | null;
  emailContacto?: string | null;
  foto?: string | null;
  idparentesco?: number | null;
  puedeRecoger?: boolean | null;
  puedeAdministrar?: boolean | null;
  sitMiembroSilencioso?: boolean | null;
}

export interface GuardarInvitadoExternoProvisionalRequest {
  idorg: number;
  nombre: string;
  apellidos: string;
  cel?: string | null;
  emailContacto?: string | null;
  idparentesco?: number | null;
  observaciones?: string | null;
}

export interface GenerarPaseInvitadoExternoRequest {
  idorg: number;
  fecha: string;
  vigenciaFin?: string | null;
  maxUsos?: number | null;
  comentarios?: string | null;
  alumnos?: { idmatricula: number }[];
}

export interface GuardarAutoFamiliarRequest {
  idorg: number;
  idfamiliamiembro?: number | null;
  placas: string;
  marca?: string | null;
  modelo?: string | null;
  color?: string | null;
  observaciones?: string | null;
}

export interface GuardarAlumnoAutorizacionRequest {
  idorg: number;
  idmatricula?: number | null;
  matricula?: string | null;
  curp?: string | null;
  alumnoReferencia?: string | null;
  idfamiliamiembro: number;
  idtiporelacionalumnousr: number;
  idparentesco?: number | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  puedeRecoger?: boolean | null;
  puedeVerAcademico?: boolean | null;
  requiereValidacionDocumento?: boolean | null;
  estatus?: string | null;
  origen?: string | null;
  comentarios?: string | null;
}

export interface CodigoCompartirAlumno {
  idmatricula: number;
  alumno?: string | null;
  fechaServicio?: string | null;
}

export interface CodigoCompartirAplicacion {
  idfamiliaDestino?: number | null;
  familiaDestino?: string | null;
  idfamiliamiembroDestino?: number | null;
  familiarDestino?: string | null;
  fechaAplicacion?: string | null;
  alumnosAgregados?: number | null;
}

export interface CodigoCompartirFamiliar {
  idfamiliamiembro: number;
  idusrbt?: number | null;
  idinvitadoexterno?: number | null;
  familiar?: string | null;
  idparentesco?: number | null;
  parentesco?: string | null;
  puedeRecoger?: boolean | null;
  requiereValidacionDocumento?: boolean | null;
  leyendaIdentificacion?: string | null;
}

export interface CodigoCompartir {
  idcodigocompartir: number;
  idorg: number;
  idfamiliaOrigen?: number | null;
  familiaOrigen?: string | null;
  codigo: string;
  tipoCompartir?: string | null;
  vigenciaInicio?: string | null;
  vigenciaFin?: string | null;
  maxUsos?: number | null;
  usosRealizados?: number | null;
  estatus?: string | null;
  estatusOperativo?: string | null;
  comentarios?: string | null;
  ubicacionMapsUrl?: string | null;
  fechaGeneracion?: string | null;
  familiarCompartido?: CodigoCompartirFamiliar | null;
  alumnos?: CodigoCompartirAlumno[];
  aplicaciones?: CodigoCompartirAplicacion[];
}

export interface GenerarCodigoCompartirRequest {
  idorg: number;
  idfamilia: number;
  idfamiliamiembro?: number | null;
  tipoCompartir?: string | null;
  vigenciaFin?: string | null;
  maxUsos?: number | null;
  fecha?: string | null;
  comentarios?: string | null;
  alumnos?: { idmatricula: number }[];
}

export interface AplicarCodigoCompartirRequest {
  idorg: number;
  idfamilia?: number | null;
  idfamiliamiembro?: number | null;
}

export interface AplicarCodigoCompartirResponse {
  idcodigocompartir: number;
  codigo: string;
  idfamilia: number;
  idfamiliamiembro: number;
  familiaresAgregados?: number | null;
  alumnosAgregados: number;
  familiarCompartido?: CodigoCompartirFamiliar | null;
  alumnos?: CodigoCompartirAlumno[];
}

export type ModoCompartirAlumno = 'PROVISIONAL' | 'PERMANENTE';
