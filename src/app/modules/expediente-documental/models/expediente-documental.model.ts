export interface SpResponse<T> {
  result: T;
  message?: string | null;
  codeNumber: number;
}

export interface ExpedienteContexto {
  familias: FamiliaAdministrable[];
  alumnos: AlumnoExpediente[];
  familiares: FamiliarExpediente[];
  calidades: CalidadRepresentacion[];
}

export interface FamiliaAdministrable {
  idfamilia: number;
  nombreFamilia?: string | null;
  esMaster: boolean;
  puedeAdministrar: boolean;
}

export interface AlumnoExpediente {
  idfamilia: number;
  idmatricula: number;
  idua: number;
  matricula?: string | null;
  nombre: string;
}

export interface FamiliarExpediente {
  idfamilia: number;
  idfamiliamiembro: number;
  idusrbtFirmante: number;
  nombre: string;
  parentesco?: string | null;
}

export interface CalidadRepresentacion {
  clave: string;
  descripcion: string;
  requiereSoporte: boolean;
}

export interface RepresentacionFamiliar {
  idrepresentacionlegal: number;
  idmatricula: number;
  idusrbtFirmante: number;
  idfamiliamiembro: number;
  calidad: string;
  calidadDescripcion: string;
  origen: string;
  estatus: string;
  fechaInicio: string;
  fechaFin?: string | null;
  firmante: string;
  observaciones?: string | null;
  soportes: number;
}

export interface DocumentoFirmante {
  idasignacion: number;
  idfirmante: number;
  estatus: string;
  estatusFirmante: string;
  asunto?: string | null;
  mensaje?: string | null;
  documento: string;
  claveDocumento: string;
  numeroVersion: number;
  fechaDisponible: string;
  fechaLimite?: string | null;
  requiereOtp: boolean;
  requiereFirmaGrafica: boolean;
  evidenciaDisponible: boolean;
}

export interface DetalleAsignacion {
  idasignacion: number;
  idfirmante: number;
  estatus: string;
  asunto?: string | null;
  mensaje?: string | null;
  documento: string;
  claveDocumento: string;
  numeroVersion: number;
  nombreArchivo: string;
  documentoHashSha256: string;
  requiereOtp: boolean;
  requiereFirmaGrafica: boolean;
  alumnos: AlumnoAsignado[];
}

export interface AlumnoAsignado {
  idmatricula: number;
  nombre: string;
  politicaFirma: string;
  firmasRequeridas: number;
}

export interface ProponerRepresentacionRequest {
  idmatricula: number;
  idfamiliamiembro: number;
  claveCalidad: string;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  observaciones?: string | null;
}

export interface OtpRegistration {
  idfirmagrafica: number;
  idotpdesafio: number;
  nonce: string;
  fechaExpiracion: string;
  destino: string;
  codigoPrueba?: string | null;
}
