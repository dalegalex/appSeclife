export interface BrigadaSemanalConsulta {
  visible: boolean;
  alumnos?: { idmatricula: number }[];
  idciclo?: number;
  cicloEscolar?: string;
  zonaHoraria?: string;
  vigencia?: string;
  permisosEfectivos?: boolean;
  brigadas: BrigadaSemanalFila[];
}
export interface BrigadaSemanalFila {
  idfila: number;
  idfamilia: number;
  familia: string;
  dias: number;
  estado: 'EN_REVISION' | 'APROBADA_PENDIENTE_ACTIVACION' | 'ACTIVA';
  familiares: { idfamiliamiembro: number; nombre: string }[];
}
