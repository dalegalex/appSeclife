export interface SpResponse<T> {
  result: T | null;
  message: string | null;
  codeNumber: number;
}

export interface FichaPersonalUsuario {
  idusr: number;
  idorg: number;
  idperfil: number;
  nombre?: string | null;
  apellidos?: string | null;
  nombreCompleto?: string | null;
  curp?: string | null;
  cargo?: string | null;
  cel?: string | null;
  email?: string | null;
  emailgmail?: string | null;
  foto?: string | null;
  fecingreso?: string | null;
}

export interface FichaPersonalData {
  [key: string]: string | number | boolean | null | undefined;
}

export interface FichaPersonalExperiencia {
  idusrfichaexperiencia: number;
  tipo: string;
  empresaInstitucion?: string | null;
  puesto?: string | null;
  periodo?: string | null;
  descripcion?: string | null;
  orden?: number | null;
}

export interface FichaPersonalDocumento {
  idctusrfichadocumento: number;
  clave: string;
  descripcion: string;
  orden: number;
  sitrequerido: boolean;
  idusrfichadocumento?: number | null;
  documentoNombre?: string | null;
  documentoUrl?: string | null;
  documentoContentType?: string | null;
  documentoTamanoBytes?: number | null;
  estatus?: string | null;
  observaciones?: string | null;
  fechaEntrega?: string | null;
  fechaValidacion?: string | null;
  documentoDigitalizado?: boolean | null;
}

export interface FichaPersonalDetalle {
  usuario: FichaPersonalUsuario | null;
  ficha: FichaPersonalData | null;
  experiencias: FichaPersonalExperiencia[];
  documentos: FichaPersonalDocumento[];
}

export interface RegistrarDocumentoFichaRequest {
  idctusrfichadocumento: number;
  documentoNombre: string;
  documentoContentType?: string | null;
  documentoTamanoBytes?: number | null;
  documentoBase64?: string | null;
  documentoUrl?: string | null;
  observaciones?: string | null;
}

export interface GuardarExperienciaFichaRequest {
  idusrfichaexperiencia?: number | null;
  tipo: string;
  empresaInstitucion?: string | null;
  puesto?: string | null;
  periodo?: string | null;
  descripcion?: string | null;
  orden?: number | null;
}
