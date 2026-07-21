export interface BitacoraAccesoResponse {
  alumno?: BitacoraAccesoAlumno | null;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  eventos?: BitacoraAccesoEvento[];
}

export interface BitacoraAccesoAlumno {
  idmatricula: number;
  matricula?: string | null;
  alumno?: string | null;
  idua?: number | null;
  gradoGrupo?: string | null;
}

export interface BitacoraAccesoEvento {
  idEvento: number;
  fuente?: string | null;
  sentido?: string | null;
  fechaHoraEvento?: string | null;
  modoSalida?: string | null;
  tipoEntrega?: string | null;
  recogio?: string | null;
  familiaRecoge?: string | null;
  medioIdentificacion?: string | null;
  puerta?: string | null;
  dispositivo?: string | null;
  auto?: string | null;
  origenModulo?: string | null;
  comentarios?: string | null;
}

export interface BitacoraAlumnoOption {
  idmatricula: number;
  alumno: string;
  matricula?: string | null;
  gradoGrupo?: string | null;
}
