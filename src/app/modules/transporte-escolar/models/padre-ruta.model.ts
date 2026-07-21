import {
  SpResponse,
  TransporteAlumnoRuta,
  TransporteEventoAlumno,
  TransporteParada,
  TransporteRecorrido,
  TransporteRutaDetalle,
  TransporteRutaListItem,
} from './conductor-ruta.model';

export type PadreAlumnoEstado = 'sin_recorrido' | 'esperando' | 'en_unidad' | 'entregado' | 'ausente' | 'incidencia';
export type TransporteSolicitudTipo = 'CAMBIO_RUTA' | 'NO_TOMA_TRANSPORTE' | 'CAMBIO_PARADA';
export type TransporteSolicitudEstatus = 'SOLICITADA' | 'AUTORIZADA' | 'RECHAZADA' | 'CANCELADA' | string;

export interface TransporteGpsPosicion {
  idgpsposicion?: number;
  idruta: number;
  ruta?: string | null;
  idunidad?: number | null;
  numEconomico?: string | null;
  placas?: string | null;
  fechaHora?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  origen?: string | null;
}

export interface PadreRutaAlumno {
  idruta: number;
  descripcion: string;
  sentido: 'ENTRADA' | 'SALIDA';
  turno: string;
  unidad: string;
  placas: string;
  conductor: string;
  alumno: string;
  idmatricula: number;
  idalumnoruta: number;
  tipoServicio?: string | null;
  lunes?: boolean | null;
  martes?: boolean | null;
  miercoles?: boolean | null;
  jueves?: boolean | null;
  viernes?: boolean | null;
  sabado?: boolean | null;
  domingo?: boolean | null;
  paradaNombre: string;
  paradaHora: string;
  paradaLatitud?: number | null;
  paradaLongitud?: number | null;
  paradaRadioMetros?: number | null;
  rutaPuntos: PadreRutaPunto[];
  estado: PadreAlumnoEstado;
  estadoTexto: string;
  rutaEstadoTexto: string;
  aproximandose: boolean;
  ultimoEvento?: TransporteEventoAlumno | null;
  recorrido?: TransporteRecorrido | null;
  gps?: TransporteGpsPosicion | null;
  eventos: TransporteEventoAlumno[];
}

export interface PadreRutaPunto {
  orden: number;
  nombre: string;
  latitud: number;
  longitud: number;
}

export interface PadreDashboard {
  fecha: string;
  idusr: number;
  alumnosPadre: PadreAlumnoUsuario[];
  alumnos: PadreRutaAlumno[];
}

export interface TransporteRutaDisponibleSolicitud {
  idruta: number;
  idorg: number;
  idua?: number | null;
  clave?: string | null;
  descripcion?: string | null;
  sentido?: 'ENTRADA' | 'SALIDA' | string | null;
  horaServicio?: string | null;
  cupoMaximo?: number | null;
  cupoOcupado?: number | null;
  cupoDisponible?: number | null;
  minutosAnticipacion?: number | null;
  fechaLimiteSolicitud?: string | null;
  puedeSolicitar?: boolean;
}

export interface TransporteSolicitud {
  idsolicitudtransporte: number;
  idorg: number;
  idusrbtSolicita?: number | null;
  idmatricula: number;
  alumno?: string | null;
  fechaServicio?: string | null;
  sentido?: 'ENTRADA' | 'SALIDA' | string | null;
  tipoSolicitud?: TransporteSolicitudTipo | string | null;
  estatus?: TransporteSolicitudEstatus | null;
  idrutaOrigen?: number | null;
  rutaOrigen?: string | null;
  idrutaparadaOrigen?: number | null;
  paradaOrigen?: string | null;
  idrutaDestino?: number | null;
  rutaDestino?: string | null;
  idrutaparadaDestino?: number | null;
  paradaDestino?: string | null;
  cupoDestinoMaximo?: number | null;
  cupoDestinoOcupado?: number | null;
  cupoDestinoDisponible?: number | null;
  motivo?: string | null;
  comentariosSolicitud?: string | null;
  comentariosResolucion?: string | null;
  fechaSolicitud?: string | null;
  fechaLimiteRespuesta?: string | null;
  sitactivo?: boolean;
}

export interface CrearSolicitudTransporteRequest {
  idorg: number;
  idmatricula: number;
  fecha: string;
  sentido: 'ENTRADA' | 'SALIDA';
  tipoSolicitud: TransporteSolicitudTipo;
  idrutaOrigen?: number | null;
  idrutaDestino?: number | null;
  idrutaparadaDestino?: number | null;
  motivo?: string | null;
  comentarios?: string | null;
}

export interface PadreAlumnoUsuario {
  idusr: number;
  usr?: string | null;
  usrNombre?: string | null;
  usrApellidos?: string | null;
  idmatricula: number;
  alumno?: string | null;
  alumnoNombre?: string | null;
  alumnoApellidos?: string | null;
  idua?: number | null;
}

export type {
  SpResponse,
  TransporteAlumnoRuta,
  TransporteEventoAlumno,
  TransporteParada,
  TransporteRecorrido,
  TransporteRutaDetalle,
  TransporteRutaListItem,
};
