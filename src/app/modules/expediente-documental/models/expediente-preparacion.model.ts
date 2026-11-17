export interface PreparacionCatalogo {
  habilitado: boolean;
  contextoResuelto: boolean;
  mensajeContexto?: string;
  idfamilia?: number;
  familia?: string;
  idciclo?: number;
  ciclo?: string;
  familias?: { idfamilia: number; nombre: string }[];
  ciclos?: { idfamilia: number; idciclo: number }[];
}
export interface PreparacionPendiente {
  responsable: 'FAMILIA' | 'COLEGIO';
  sujeto: string;
  campo: string;
  donde: string;
  alFirmar: boolean;
}
export interface PreparacionDocumento {
  version: number;
  idmatricula: number;
  documento: string;
  alumnos: string[];
  estado: 'FALTAN_DATOS' | 'PENDIENTE_COLEGIO' | 'PENDIENTE_ASIGNACION' | 'YA_ASIGNADO' | 'NO_VERIFICADO' | 'AUTOMATICO_NO_ACTIVO';
  asignacionesRegistradas?: number[];
  modoAsignacion: 'MANUAL' | 'AUTOMATICO';
  asignacionAutomatica: false;
  mensajeAsignacion: string;
  pendientes: PreparacionPendiente[];
}
export interface PreparacionResultado extends PreparacionCatalogo {
  idfamilia: number;
  idciclo: number;
  asignacionAutomatica: false;
  consultadoUtc: string;
  documentos: PreparacionDocumento[];
}
