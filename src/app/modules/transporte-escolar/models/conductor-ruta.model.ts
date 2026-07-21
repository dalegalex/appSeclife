export interface ConductorAlumno {
  idalumnoruta: number;
  idrutaparada: number;
  nombre: string;
  grado: string;
  parada: string;
  estado: 'pendiente' | 'pendiente_sync' | 'registrado' | 'ausente' | 'incidencia';
  ultimoEvento?: string | null;
  clientEventIdPendiente?: string | null;
}

export interface ConductorParada {
  idrutaparada: number;
  orden: number;
  nombre: string;
  horaProgramada: string;
  latitud?: number | null;
  longitud?: number | null;
  radioMetros?: number | null;
  alumnos: ConductorAlumno[];
}

export interface ConductorRuta {
  idrecorrido?: number | null;
  idruta: number;
  idunidad: number | null;
  descripcion: string;
  sentido: 'ENTRADA' | 'SALIDA';
  turno: string;
  unidad: string;
  placas: string;
  conductor: string;
  estatus: 'pendiente' | 'en_recorrido' | 'finalizada';
  paradas: ConductorParada[];
  intervaloGpsSegundos?: number | null;
  modoPrueba?: boolean;
}

export interface TransporteRecorrido {
  idrecorrido: number;
  idruta: number;
  idrutaunidad?: number | null;
  idunidad?: number | null;
  idconductor?: number | null;
  fecha?: string | null;
  estatus?: 'EN_CURSO' | 'FINALIZADO' | 'CANCELADO' | string | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  origen?: string | null;
  eventos?: TransporteEventoAlumno[];
}

export interface TransporteEventoAlumno {
  idevento: number;
  idrecorrido?: number | null;
  idalumnoruta: number;
  idrutaparada?: number | null;
  tipoEvento?: string | null;
  fechaHora?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  origen?: string | null;
  comentarios?: string | null;
}

export interface SpResponse<T> {
  result: T | null;
  message: string | null;
  codeNumber: number;
}

export interface TransporteRutaListItem {
  idruta: number;
  idorg: number;
  idua: number | null;
  clave: string;
  descripcion: string;
  sentido?: string | null;
  tipoServicio?: string | null;
  turno?: string | null;
  estatus?: string | null;
  cupoMaximo?: number | null;
  intervaloGpsSegundos?: number | null;
  sitactivo: boolean;
  unidad?: {
    idunidad?: number | null;
    numEconomico?: string | null;
    placas?: string | null;
    capacidad?: number | null;
  } | null;
  conductor?: {
    idconductor?: number | null;
    nombre?: string | null;
    telefono?: string | null;
  } | null;
}

export interface TransporteRutaDetalle extends TransporteRutaListItem {
  paradas?: TransporteParada[];
  alumnos?: TransporteAlumnoRuta[];
  asignacionActual?: TransporteAsignacionUnidad | null;
}

export interface TransporteParada {
  idrutaparada: number;
  orden: number;
  nombre: string;
  descripcion?: string | null;
  horaProgramada?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  radioMetros?: number | null;
  sitactivo?: boolean;
}

export interface TransporteAlumnoRuta {
  idalumnoruta: number;
  idmatricula: number;
  alumno?: string | null;
  idrutaparadaSubida?: number | null;
  idrutaparadaBajada?: number | null;
  lunes?: boolean | null;
  martes?: boolean | null;
  miercoles?: boolean | null;
  jueves?: boolean | null;
  viernes?: boolean | null;
  sabado?: boolean | null;
  domingo?: boolean | null;
  sitactivo?: boolean;
}

export interface TransporteAsignacionUnidad {
  idrutaunidad?: number | null;
  idunidad?: number | null;
  numEconomico?: string | null;
  placas?: string | null;
  capacidad?: number | null;
  idconductor?: number | null;
  conductor?: string | null;
  telefono?: string | null;
}
