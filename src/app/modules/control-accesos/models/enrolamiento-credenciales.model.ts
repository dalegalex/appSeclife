export type PerfilEnrolamiento = 1 | 4 | 5;

export interface SujetoEnrolamiento {
  idperfil: PerfilEnrolamiento;
  idperfilCredencial: PerfilEnrolamiento;
  subjectKey: string;
  idusrbt?: number | null;
  idmatricula?: number | null;
  matricula?: string | null;
  numeroEmpleado?: string | null;
  curp?: string | null;
  nombre: string;
  apellidos: string;
  displayName: string;
  familia?: string | null;
  contexto?: string | null;
  unidadAdministrativa?: string | null;
  cargo?: string | null;
  idtag?: number | null;
  codigo?: string | null;
  tieneTag: boolean;
  tagBloqueado?: boolean;
  tagSituacion?: number | null;
  tieneCorreo: boolean;
  tieneFoto: boolean;
  fotoValidada?: boolean;
}

export interface SpResponse<T> {
  result: T | null;
  message?: string;
  codeNumber?: number;
}

export interface FotoEnrolamientoRequest {
  idorg: number;
  idperfil: PerfilEnrolamiento;
  idusrbtMiembro?: number | null;
  idmatricula?: number | null;
  subjectKey: string;
  fotoBase64: string;
  fotoContentType: string;
  fotoNombreArchivo: string;
  fotoAncho: number;
  fotoAlto: number;
  procesamientoEstado: 'SIN_PROCESAR';
  procesamientoMetodo: 'DISPOSITIVO';
  metadata: Record<string, unknown>;
}

export interface FotoCredencialResult {
  idcredencialfoto: number;
  subjectKey: string;
  fotoUrl?: string | null;
  fotoContentType?: string | null;
  fotoNombreArchivo?: string | null;
  fotoAncho?: number | null;
  fotoAlto?: number | null;
  procesamientoEstado?: string | null;
  sitvalidada?: boolean | null;
}

export interface RotarTagEnrolamientoRequest {
  idorg: number;
  idperfil: PerfilEnrolamiento;
  idmatricula?: number | null;
  idusrbtSujeto?: number | null;
  subjectKey: string;
  codigoNfc: string;
  motivo: string;
}

export interface RotarTagEnrolamientoResult {
  subjectKey: string;
  idperfilCredencial: PerfilEnrolamiento;
  idtagAnterior?: number | null;
  idtagNuevo: number;
  codigoAnteriorMascara?: string | null;
  codigoNuevoMascara: string;
  accion: 'ASIGNACION' | 'ROTACION' | 'ACTUALIZACION_CODIGO' | 'SIN_CAMBIO';
  traceId: string;
}
