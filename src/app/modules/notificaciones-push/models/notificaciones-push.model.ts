export interface SpResponse<T> {
  result?: T | null;
  message?: string | null;
  codeNumber: number;
}

export type NotificacionPushReadFilter = '' | 'LEIDAS' | 'NO_LEIDAS';

export interface NotificacionPushHistorialFilters {
  idmatricula?: number | null;
  estado: NotificacionPushReadFilter;
  tipoEvento?: string | null;
  texto: string;
  page: number;
  pageSize: number;
}

export interface NotificacionPushHistorialPage {
  page: number;
  pageSize: number;
  total: number;
  totalNoLeidas: number;
  items: NotificacionPushHistorialItem[];
}

export interface NotificacionPushHistorialItem {
  idnotificacion: number;
  tipoEvento: string;
  tipoEventoDescripcion: string;
  moduloOrigen: string;
  idmatricula?: number | null;
  titulo: string;
  cuerpo: string;
  dataJson?: string | null;
  fechaCreacion: string;
  fechaEnviada?: string | null;
  fechaLeida?: string | null;
  leida: boolean;
}

export interface NotificacionPushPreferencia {
  tipoEvento: string;
  descripcion: string;
  moduloOrigen: string;
  activo: boolean;
  idmatricula?: number | null;
}

export interface GuardarNotificacionPushPreferenciaRequest {
  idmatricula?: number | null;
  tipoEvento: string;
  activo: boolean;
}

export interface RegistrarDispositivoPushRequest {
  token: string;
  platform: 'android' | 'ios' | 'web';
  app: 'appSeclife';
  deviceId: string;
  appVersion?: string | null;
  timezone?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  operatingSystem?: string | null;
  osVersion?: string | null;
  androidSdkVersion?: number | null;
  isVirtual?: boolean | null;
  webViewVersion?: string | null;
}

export interface CrearEventoPushRequest {
  idorg: number;
  tipoEvento: string;
  idusrDestino: number;
  idmatricula?: number | null;
  moduloOrigen: string;
  entidadOrigen: string;
  idOrigen: string;
  llaveIdempotente: string;
  titulo?: string | null;
  cuerpo?: string | null;
  data?: Record<string, unknown> | null;
  prioridad?: number | null;
}