export interface SpResponse<T> {
  result: T | null;
  message?: string | null;
  codeNumber?: number | null;
}

export interface CarruselIsla {
  idcarruselisla: number;
  clave?: string | null;
  descripcion?: string | null;
  orden?: number | null;
}

export interface CarruselSesion {
  idcarruselsesion: number;
  idorg: number;
  idua?: number | null;
  idpuerta?: number | null;
  nombrePuntoEntrega?: string | null;
  fechaServicio?: string | null;
  numeroIslas: number;
  estatus: string;
  dispositivoEntregaUid?: string | null;
  idusrbtEntrega?: number | null;
  operadorEntrega?: string | null;
  idcarruseldispositivoEntrega?: number | null;
  lectores?: number | null;
  lectoresConectados?: number | null;
  pendientes?: number | null;
  islas?: CarruselIsla[];
}

export interface CarruselDispositivo {
  idcarruseldispositivo: number;
  idcarruselsesion?: number | null;
  rolOperativo?: string | null;
  idusrbtOperador?: number | null;
  dispositivoUid?: string | null;
  nombreDispositivo?: string | null;
  signalrConnectionId?: string | null;
  estatusConexion?: string | null;
}

export interface CarruselAlumnoEntrega {
  idcarruselentregaalumno: number;
  idmatricula: number;
  alumno: string;
  gradoGrupo?: string | null;
  tieneFoto?: boolean | null;
  fotoSubjectKey?: string | null;
  estatus: 'PENDIENTE' | 'LLAMADO' | 'ENTREGADO' | 'CANCELADO' | string;
  estatusPrevio?: string | null;
  familiarRecoge?: string | null;
  nombreFamilia?: string | null;
  fechaHoraEntrega?: string | null;
  idaccesoregistro?: number | null;
}

export interface CarruselPaquete {
  idcarrusellectura: number;
  idcarruselsesion: number;
  posicionCola: number;
  idcarruselisla?: number | null;
  isla?: string | null;
  nombreFamilia?: string | null;
  familiarRecoge?: string | null;
  idfamiliamiembro?: number | null;
  idusrbtFamiliar?: number | null;
  familiarTieneFoto?: boolean | null;
  familiarFotoSubjectKey?: string | null;
  fechaHoraLectura?: string | null;
  idautofamiliar?: number | null;
  placas?: string | null;
  autoDescripcion?: string | null;
  otroAuto?: boolean | null;
  entregaPeatonal?: boolean | null;
  dispositivoLectura?: string | null;
  estatus: string;
  alumnos?: CarruselAlumnoEntrega[];
}

export interface AbrirCarruselRequest {
  idorg: number;
  idua?: number | null;
  idpuerta?: number | null;
  nombrePuntoEntrega?: string | null;
  numeroIslas: number;
  dispositivoUid?: string | null;
  nombreDispositivo?: string | null;
  signalrConnectionId?: string | null;
  comentarios?: string | null;
}

export interface RegistrarAvisoCarruselRequest {
  idorg: number;
  idcarruseldispositivo?: number | null;
  idfamiliamiembro?: number | null;
  idinvitadoexternoRecoge?: number | null;
  codigo?: string | null;
  codigoLeido?: string | null;
  idmedioIdentificacion?: number | null;
  iddispositivo?: number | null;
  idautofamiliar?: number | null;
  otroAuto?: boolean | null;
  entregaPeatonal?: boolean | null;
  comentarios?: string | null;
  alumnos: Array<{
    idmatricula: number;
    idalumnoautorizacion?: number | null;
    idfamiliamiembro?: number | null;
  }>;
}

export interface RegistrarPuntoCarruselRequest {
  idorg: number;
  idcarruselsesion?: number | null;
  iddispositivo?: number | null;
  rolOperativo: 'LECTURA' | 'MONITOR' | 'ENTREGA' | string;
  dispositivoUid?: string | null;
  nombreDispositivo?: string | null;
  signalrConnectionId?: string | null;
}

export interface AsociarPuntoCarruselRequest {
  idorg: number;
}

export interface DesconectarPuntoCarruselRequest {
  idorg: number;
}

export interface ConfirmarEntregaCarruselRequest {
  idorg?: number | null;
  comentarios?: string | null;
  alumnos?: Array<{
    idcarruselentregaalumno: number;
  }>;
}

export interface CancelarAlumnoCarruselRequest {
  idorg?: number | null;
  comentarios?: string | null;
}

export interface CerrarCarruselRequest {
  idorg: number;
  comentarios?: string | null;
}
