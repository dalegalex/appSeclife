export interface CredencialDigital {
  tipoPortador?: 'ALUMNO' | 'FAMILIAR' | 'PERSONAL' | string | null;
  idtag?: number | null;
  codigo?: string | null;
  qrPayload?: string | null;
  idorg?: number | null;
  idua?: number | null;
  unidadAdministrativa?: string | null;
  idciclo?: number | null;
  cicloEscolar?: string | null;
  idmatricula?: number | null;
  nombre?: string | null;
  apellidos?: string | null;
  familia?: string | null;
  puesto?: string | null;
  fechaNacimiento?: string | null;
  tipoSangre?: string | null;
  alergias?: string | null;
  foto?: string | null;
  plantilla?: CredencialDigitalPlantilla | null;
}

export interface CredencialDigitalPlantilla {
  idplantillacredencial?: number | null;
  nombre?: string | null;
  versionPlantilla?: number | null;
  fondoUrl?: string | null;
  logoUrl?: string | null;
  colorPrimario?: string | null;
  colorSecundario?: string | null;
  textoPie?: string | null;
  layoutJson?: unknown;
  configuracionPendiente?: boolean | null;
}

export type CredencialDigitalLayoutFieldKey =
  | 'tipoPortador'
  | 'nombre'
  | 'apellidos'
  | 'familia'
  | 'cicloEscolar'
  | 'unidadAdministrativa'
  | 'fechaNacimiento'
  | 'tipoSangre'
  | 'alergias'
  | 'cargo'
  | 'foto'
  | 'qr'
  | 'textoPie';

export interface CredencialDigitalLayoutField {
  key: CredencialDigitalLayoutFieldKey;
  label?: string | null;
  enabled?: boolean | null;
  x?: number | null;
  y?: number | null;
  width?: number | null;
  height?: number | null;
  fontSize?: number | null;
  fontFamily?: string | null;
  align?: 'left' | 'center' | 'right' | string | null;
  color?: string | null;
}

export interface CredencialDigitalLayout {
  version?: number | null;
  fondoOpacity?: number | null;
  fields?: CredencialDigitalLayoutField[] | null;
}
