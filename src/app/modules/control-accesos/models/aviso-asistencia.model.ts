export interface SpResponse<T> {
  result?: T | null;
  message?: string | null;
  codeNumber: number;
}

export interface CrearAvisoAsistenciaRequest {
  idorg: number;
  idmatricula: number;
  tipoPermiso: string;
  fecha?: string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  motivo?: string | null;
  comentariosSolicitud?: string | null;
  documentoNombre?: string | null;
  documentoUrl?: string | null;
  documentoContentType?: string | null;
  documentoTamanoBytes?: number | null;
  documentoBase64?: string | null;
}

export interface AvisoAsistencia {
  idpermisoalumno: number;
  idmatricula?: number | null;
  alumno?: string | null;
  gradoGrupo?: string | null;
  tipoPermiso?: string | null;
  estatus?: string | null;
  fechaHoraInicio?: string | null;
  fechaHoraFin?: string | null;
  motivo?: string | null;
  comentariosSolicitud?: string | null;
  comentariosResolucion?: string | null;
  documentoNombre?: string | null;
  documentoUrl?: string | null;
  fechaSolicitud?: string | null;
  fechaResolucion?: string | null;
}

export interface AvisosAsistenciaFamiliaResponse {
  avisos?: AvisoAsistencia[] | null;
}
