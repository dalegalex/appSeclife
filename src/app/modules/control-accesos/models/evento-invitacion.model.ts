export interface EventoAcompanante {
  idacompanante?: number | null;
  nombreCompleto: string;
}

export interface EventoInvitacionFamiliar {
  idinvitacion: number;
  idfamilia: number;
  nombreFamilia?: string | null;
  ideventoacceso: number;
  nombre?: string | null;
  lugar?: string | null;
  fechaEvento?: string | null;
  horaProgramada?: string | null;
  aviso?: string | null;
  maxParticipantesFamilia?: number | null;
  confirmacionRequerida?: boolean | null;
  fechaLimiteConfirmacion?: string | null;
  estatusInvitacion?: 'ACTIVA' | 'CANCELADA' | string | null;
  estatusEvento?: 'PROGRAMADO' | 'ACTIVO' | 'CANCELADO' | string | null;
  motivoCancelacion?: string | null;
  fechaCancelacion?: string | null;
  estatusRespuesta?: 'PENDIENTE' | 'CONFIRMADA' | 'DECLINADA' | string | null;
  participantesEstimados?: number | null;
  idusrbtResponde?: number | null;
  respondio?: string | null;
  fechaRespuesta?: string | null;
  destinatarioActual?: 'MASTER' | 'ADMINISTRA_RED' | string | null;
  acompanantes?: EventoAcompanante[] | null;
}

export interface MisInvitacionesEventoResult {
  invitaciones?: EventoInvitacionFamiliar[] | null;
}

export interface ResponderInvitacionEventoRequest {
  estatusRespuesta: 'CONFIRMADA' | 'DECLINADA';
  acompanantes: Array<{ nombreCompleto: string }>;
  comentarios?: string | null;
}

export interface SpResponse<T> {
  result?: T | null;
  message?: string | null;
  codeNumber: number;
}
