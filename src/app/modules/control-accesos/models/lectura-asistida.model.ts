export interface SpResponse<T> {
  result: T | null;
  message?: string | null;
  codeNumber?: number | null;
}

export interface UnidadAdministrativaLectura {
  idua: number;
  idorg?: number | null;
  descripcion: string;
  clave?: string | null;
  orden?: number | null;
  sitactivo?: boolean | null;
}

export type SentidoAcceso = 'ENTRADA' | 'SALIDA';
export type TipoLecturaAsistida = 'ALUMNO' | 'FAMILIAR' | 'INVITADO_EXTERNO';

export interface ResolverLecturaAsistidaParams {
  idorg: number;
  codigo?: string | null;
  idtag?: number | null;
  sentido: SentidoAcceso;
  iduas?: number[] | null;
  mostrarFoto?: boolean | null;
  fechaHoraEvento?: string | null;
}

export interface RegistrarLecturaAsistidaRequest {
  idorg: number;
  codigo?: string | null;
  codigoLeido?: string | null;
  idtag?: number | null;
  sentido: SentidoAcceso;
  modoAviso?: boolean | null;
  fechaHoraEvento?: string | null;
  idmedioIdentificacion?: number | null;
  idpuerta?: number | null;
  iddispositivo?: number | null;
  idautofamiliar?: number | null;
  otroAuto?: boolean | null;
  latitud?: number | null;
  longitud?: number | null;
  comentarios?: string | null;
  origenModulo?: string | null;
  idorigenModulo?: number | null;
  alumnos: LecturaAsistidaAlumnoSeleccionado[];
}

export interface LecturaAsistidaAlumnoSeleccionado {
  idmatricula: number;
  idalumnoautorizacion?: number | null;
  idfamiliamiembro?: number | null;
}

export interface LecturaAsistidaResponse {
  tipoLectura: TipoLecturaAsistida;
  sentido: SentidoAcceso;
  fecha: string;
  modoAvisoDisponible?: boolean;
  credencial?: LecturaAsistidaCredencial | null;
  familiar?: LecturaAsistidaFamiliar | null;
  alumno?: LecturaAsistidaAlumno | null;
  alumnos?: LecturaAsistidaAlumno[];
  autos?: LecturaAsistidaAuto[];
}

export interface LecturaAsistidaCredencial {
  idtag?: number | null;
  codigo?: string | null;
  idperfil: number;
  idusrbt?: number | null;
  idmatricula?: number | null;
  sittipotag?: boolean | null;
  esPaseProvisional?: boolean | null;
}

export interface LecturaAsistidaFamiliar {
  idfamiliamiembro: number;
  idfamilia: number;
  idusrbt?: number | null;
  idinvitadoexterno?: number | null;
  familiar: string;
  foto?: string | null;
  idparentesco?: number | null;
  parentesco?: string | null;
  tipoRelacion?: string | null;
  tipoRelacionDescripcion?: string | null;
  puedeRecoger?: boolean | null;
  puedeAdministrar?: boolean | null;
  sitMiembroSilencioso?: boolean | null;
  requiereValidacionDocumento?: boolean | null;
  leyendaIdentificacion?: string | null;
}

export interface LecturaAsistidaAuto {
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

export interface LecturaAsistidaAlumno {
  idalumnoautorizacion?: number | null;
  idfamiliamiembro?: number | null;
  idfamilia?: number | null;
  idmatricula: number;
  matricula?: string | null;
  alumno: string;
  foto?: string | null;
  idua?: number | null;
  idgpo?: number | null;
  idciclo?: number | null;
  gradoGrupo?: string | null;
  idparentesco?: number | null;
  parentesco?: string | null;
  tipoRelacion?: string | null;
  tipoRelacionDescripcion?: string | null;
  puedeRecoger?: boolean | null;
  requiereValidacionDoc?: boolean | null;
  seleccionado?: boolean | null;
  disponible?: boolean | null;
  yaTieneSentidoHoy?: boolean | null;
  estatusSalida?: 'MODO_AVISO' | 'REGISTRO_SALIDA' | string | null;
  fechaHoraSalida?: string | null;
  permisoAusencia?: LecturaAsistidaAusencia | null;
  ultimaLectura?: LecturaAsistidaUltimaLectura | null;
}

export interface LecturaAsistidaAusencia {
  idausenciaalumno: number;
  fechaInicio: string;
  fechaFin: string;
  motivo?: string | null;
}

export interface LecturaAsistidaUltimaLectura {
  idaccesoalumno: number;
  sentido: SentidoAcceso;
  fechaHoraEvento: string;
}

export interface LecturaAsistidaRegistroResponse {
  sentido: SentidoAcceso;
  fechaHoraEvento: string;
  registros: LecturaAsistidaRegistro[];
}

export interface LecturaAsistidaRegistro {
  idaccesoregistro: number;
  idaccesoalumno: number;
  idmatricula: number;
}
