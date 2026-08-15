export interface SpEventoFamiliarResponse<T> {
  result?: T | null;
  message?: string | null;
  codeNumber?: number | null;
}

export interface EventoFamiliarAlumno {
  idmatricula: number;
  alumno: string;
  grupo?: string | null;
  seleccionado?: boolean | null;
  autorizaSalida?: boolean | null;
  estatus?: string | null;
}

export interface EventoFamiliarRespuesta {
  idrespuestaevento: number;
  idfamiliaInvitada: number;
  familiaInvitada: string;
  estatusRespuesta?: string | null;
  fechaRespuesta?: string | null;
  comentarios?: string | null;
  alumnos?: EventoFamiliarAlumno[] | null;
}

export interface EventoFamiliarSocial {
  ideventofamiliar: number;
  idorg?: number | null;
  idciclo?: number | null;
  idfamiliaAnfitriona?: number | null;
  familiaAnfitriona?: string | null;
  idfamiliamiembroAnfitrion?: number | null;
  anfitrion?: string | null;
  nombre: string;
  descripcion?: string | null;
  fechaEvento?: string | null;
  horaEvento?: string | null;
  horaSalidaColegio?: string | null;
  ubicacionGeneral?: string | null;
  domicilio?: string | null;
  telefonoContacto?: string | null;
  maxAlumnosInvitados?: number | null;
  confirmados?: number | null;
  fechaLimiteConfirmacion?: string | null;
  requiereAutorizacionSalida?: boolean | null;
  estatus?: string | null;
  codigoMascara?: string | null;
  codigo?: string | null;
  tokenUid?: string | null;
  esAnfitrion?: boolean | null;
  idrespuestaevento?: number | null;
  idfamiliaInvitada?: number | null;
  estatusRespuesta?: string | null;
  fechaRespuesta?: string | null;
  alumnos?: EventoFamiliarAlumno[] | null;
}

export interface EventoFamiliarPase {
  ideventofamiliar: number;
  nombre: string;
  familiaAnfitriona?: string | null;
  fechaEvento?: string | null;
  ubicacionGeneral?: string | null;
  codigo: string;
  tokenUid: string;
  leyenda: string;
}

export interface GuardarEventoFamiliarSocialRequest {
  idorg: number;
  idciclo?: number | null;
  idfamilia: number;
  idfamiliamiembroAnfitrion: number;
  nombre: string;
  descripcion: string;
  fechaEvento: string;
  horaEvento?: string | null;
  horaSalidaColegio?: string | null;
  ubicacionGeneral?: string | null;
  domicilio: string;
  telefonoContacto: string;
  maxAlumnosInvitados: number;
  fechaLimiteConfirmacion?: string | null;
  requiereAutorizacionSalida: boolean;
}
