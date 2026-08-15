export interface SpResponse<T> {
  result: T | null;
  message?: string | null;
  codeNumber?: number | null;
}

export interface AutogestionCatalogos {
  eventos?: AutogestionEvento[] | null;
  areas?: AutogestionArea[] | null;
  puntos?: AutogestionPunto[] | null;
}

export interface AutogestionEvento {
  ideventoacceso: number;
  idorg?: number | null;
  nombre?: string | null;
  lugar?: string | null;
  fechaEvento?: string | null;
  horaProgramada?: string | null;
  maxParticipantesFamilia?: number | null;
  aviso?: string | null;
  modalidadAcceso?: 'ABIERTO' | 'POR_INVITACION' | string | null;
  confirmacionRequerida?: boolean | null;
  fechaLimiteConfirmacion?: string | null;
  familiasInvitadas?: number | null;
  familiasConfirmadas?: number | null;
  asistentesRegistrados?: number | null;
  estatus?: string | null;
  sitactivo?: boolean | null;
}

export interface AutogestionArea {
  idareavisita: number;
  idorg?: number | null;
  codigo?: string | null;
  clave?: string | null;
  descripcion?: string | null;
  orden?: number | null;
  sitactivo?: boolean | null;
}

export interface AutogestionPunto {
  idpuntoautogestion: number;
  idorg?: number | null;
  descripcion?: string | null;
  codigo?: string | null;
  modo?: string | null;
  ingresoAutomatico?: boolean | null;
  emitirAudio?: boolean | null;
  nfcHabilitado?: boolean | null;
  pinConfigurado?: boolean | null;
  sesionAbierta?: AutogestionSesion | null;
  idareavisita?: number | null;
  areaVisita?: string | null;
  estatus?: string | null;
  sitactivo?: boolean | null;
}

export interface AutogestionSesion {
  idsesionautogestion: number;
  idorg?: number | null;
  idpuntoautogestion?: number | null;
  punto?: string | null;
  modo?: 'EVENTO' | 'ASISTENCIA' | string | null;
  ideventoacceso?: number | null;
  evento?: string | null;
  idareavisita?: number | null;
  areaVisita?: string | null;
  fechaServicio?: string | null;
  estatus?: string | null;
  ingresoAutomatico?: boolean | null;
  emitirAudio?: boolean | null;
  nfcHabilitado?: boolean | null;
}

export interface AbrirSesionAutogestionRequest {
  idorg: number;
  idpuntoautogestion: number;
  pinOperador: string;
  modo: 'EVENTO' | 'ASISTENCIA';
  ideventoacceso?: number | null;
  idareavisita?: number | null;
  fecha?: string | null;
  ingresoAutomatico?: boolean | null;
  emitirAudio?: boolean | null;
  comentarios?: string | null;
}

export interface ResolverAutogestionEventoParams {
  idorg: number;
  ideventoacceso: number;
  idsesionautogestion?: number | null;
  codigo?: string | null;
  idtag?: number | null;
  fechaHoraEvento?: string | null;
}

export interface AutogestionEventoLectura {
  ideventoacceso: number;
  evento?: string | null;
  lugar?: string | null;
  fechaEvento?: string | null;
  horaProgramada?: string | null;
  maxParticipantesFamilia?: number | null;
  aviso?: string | null;
  idtag?: number | null;
  codigo?: string | null;
  idperfil?: number | null;
  idusrbt?: number | null;
  participante?: string | null;
  siguienteMovimiento?: 'ENTRADA' | 'SALIDA' | string | null;
  ultimoMovimiento?: 'ENTRADA' | 'SALIDA' | string | null;
  ultimaFecha?: string | null;
}

export interface ResolverAutogestionAsistenciaParams {
  idorg: number;
  idsesionautogestion: number;
  codigo?: string | null;
  idtag?: number | null;
  fechaHoraEvento?: string | null;
}

export interface AutogestionAsistenciaLectura {
  tipoLectura?: 'ALUMNO' | 'USUARIO' | string | null;
  idperfil?: number | null;
  idtag?: number | null;
  codigo?: string | null;
  idusrbt?: number | null;
  idmatricula?: number | null;
  participante?: string | null;
  grupo?: string | null;
  siguienteMovimiento?: 'ENTRADA' | 'SALIDA' | string | null;
  ultimoMovimiento?: 'ENTRADA' | 'SALIDA' | string | null;
  ultimaFecha?: string | null;
  requiereArea?: boolean | null;
  idareavisita?: number | null;
}

export interface RegistrarAutogestionEventoRequest {
  idorg: number;
  ideventoacceso: number;
  idsesionautogestion?: number | null;
  codigo?: string | null;
  codigoLeido?: string | null;
  idtag?: number | null;
  fechaHoraEvento?: string | null;
  participantes?: number | null;
  idmedioIdentificacion?: number | null;
  comentarios?: string | null;
}

export interface RegistrarAutogestionAsistenciaRequest {
  idorg: number;
  idsesionautogestion: number;
  codigo?: string | null;
  codigoLeido?: string | null;
  idtag?: number | null;
  fechaHoraEvento?: string | null;
  idareavisita?: number | null;
  idmedioIdentificacion?: number | null;
  comentarios?: string | null;
}

export interface AutogestionEventoRegistro {
  ideventoasistencia: number;
  ideventoacceso: number;
  idtag?: number | null;
  idperfil?: number | null;
  idusrbt?: number | null;
  tipoMovimiento?: 'ENTRADA' | 'SALIDA' | string | null;
  fechaHoraEvento?: string | null;
  participantes?: number | null;
}

export interface AutogestionAsistenciaRegistro {
  idaccesoregistro: number;
  idaccesoalumno?: number | null;
  idaccesousr?: number | null;
  idperfil?: number | null;
  idtag?: number | null;
  idusrbt?: number | null;
  idmatricula?: number | null;
  tipoMovimiento?: 'ENTRADA' | 'SALIDA' | string | null;
  fechaHoraEvento?: string | null;
}
