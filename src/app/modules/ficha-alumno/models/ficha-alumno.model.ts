export interface SpResponse<T> {
  result: T | null;
  message: string | null;
  codeNumber: number;
}

export interface FichaAlumnoResumen {
  idmatricula: number;
  matricula?: string | null;
  idorg?: number | null;
  nombre?: string | null;
  primerApellido?: string | null;
  segundoApellido?: string | null;
  nombreCompleto?: string | null;
  nombreCorto?: string | null;
  curp?: string | null;
  foto?: string | null;
  gradoGrupo?: string | null;
  idfamilia?: number | null;
  idfamiliamiembro?: number | null;
  puedeVerAcademico?: boolean | null;
}

export interface FichaAlumnoData {
  idalumnoficha?: number | null;
  idmatricula?: number | null;
  idorg?: number | null;
  ciclo_ingreso?: string | null;
  cicloIngreso?: string | null;
  grado_ingreso?: string | null;
  gradoIngreso?: string | null;
  escuela_procedencia?: string | null;
  escuelaProcedencia?: string | null;
  tipo_alumno?: string | null;
  tipoAlumno?: string | null;
  modalidad?: string | null;
  turno?: string | null;
  estatus_inscripcion?: string | null;
  estatusInscripcion?: string | null;
  tutor_academico?: string | null;
  tutorAcademico?: string | null;
  observaciones_escolares?: string | null;
  observacionesEscolares?: string | null;
  direccion_calle?: string | null;
  direccionCalle?: string | null;
  direccion_numero?: string | null;
  direccionNumero?: string | null;
  direccion_colonia?: string | null;
  direccionColonia?: string | null;
  direccion_municipio?: string | null;
  direccionMunicipio?: string | null;
  direccion_estado?: string | null;
  direccionEstado?: string | null;
  direccion_cp?: string | null;
  direccionCp?: string | null;
  referencia_domicilio?: string | null;
  referenciaDomicilio?: string | null;
  telefono_casa?: string | null;
  telefonoCasa?: string | null;
  email_institucional?: string | null;
  emailInstitucional?: string | null;
  email_personal?: string | null;
  emailPersonal?: string | null;
  tipo_sangre?: string | null;
  tipoSangre?: string | null;
  alergias?: string | null;
  enfermedades_cronicas?: string | null;
  enfermedadesCronicas?: string | null;
  medicamentos_permanentes?: string | null;
  medicamentosPermanentes?: string | null;
  discapacidad?: string | null;
  necesidad_especial?: string | null;
  necesidadEspecial?: string | null;
  medico_familiar?: string | null;
  medicoFamiliar?: string | null;
  telefono_medico?: string | null;
  telefonoMedico?: string | null;
  hospital_preferente?: string | null;
  hospitalPreferente?: string | null;
  seguro_medico?: string | null;
  seguroMedico?: string | null;
  poliza_seguro?: string | null;
  polizaSeguro?: string | null;
  observaciones_enfermeria?: string | null;
  observacionesEnfermeria?: string | null;
  necesidad_educativa?: string | null;
  necesidadEducativa?: string | null;
  adecuacion_curricular?: string | null;
  adecuacionCurricular?: string | null;
  seguimiento_psicologico?: string | null;
  seguimientoPsicologico?: string | null;
  terapia_externa?: string | null;
  terapiaExterna?: string | null;
  observaciones_orientacion?: string | null;
  observacionesOrientacion?: string | null;
  alertas_convivencia?: string | null;
  alertasConvivencia?: string | null;
  transporte_escolar?: boolean | null;
  transporteEscolar?: boolean | null;
  comedor?: boolean | null;
  talleres?: string | null;
  beca?: string | null;
  seguro_escolar?: string | null;
  seguroEscolar?: string | null;
  credencial_estatus?: string | null;
  credencialEstatus?: string | null;
  tag_estatus?: string | null;
  tagEstatus?: string | null;
  observaciones_servicios?: string | null;
  observacionesServicios?: string | null;
}

export interface FichaAlumnoDocumento {
  idctalumnofichadocumento: number;
  clave: string;
  descripcion: string;
  rubro?: string | null;
  orden: number;
  sitrequerido: boolean;
  visibleAppPadre?: boolean | null;
  idalumnofichadocumento?: number | null;
  documentoNombre?: string | null;
  documentoUrl?: string | null;
  documentoContentType?: string | null;
  documentoTamanoBytes?: number | null;
  estatus?: string | null;
  observaciones?: string | null;
  fechaEntrega?: string | null;
  fechaValidacion?: string | null;
  documentoDigitalizado?: boolean | null;
}

export interface FichaAlumnoAutorizacion {
  idctalumnofichaautorizacion: number;
  clave: string;
  descripcion: string;
  textoAutorizacion?: string | null;
  versionTexto?: string | null;
  hashTextoHex?: string | null;
  iddocumentodigitaltexto?: number | null;
  vigenteDesde?: string | null;
  vigenteHasta?: string | null;
  iddocumentodigitaladjunto?: number | null;
  adjuntoNombre?: string | null;
  adjuntoContentType?: string | null;
  adjuntoTamanoBytes?: number | null;
  adjuntoHashHex?: string | null;
  rubro?: string | null;
  requiereValidacionColegio?: boolean | null;
  permiteRechazo?: boolean | null;
  visibleAppPadre?: boolean | null;
  idalumnofichaautorizacion?: number | null;
  respuesta?: string | null;
  fechaRespuesta?: string | null;
  origenRespuesta?: string | null;
  idusrbtResponsable?: number | null;
  idfamiliamiembro?: number | null;
  estatusValidacion?: string | null;
  observaciones?: string | null;
  fechaValidacion?: string | null;
}

export interface FichaAlumnoDetalle {
  alumno: FichaAlumnoResumen | null;
  ficha: FichaAlumnoData | null;
  documentos: FichaAlumnoDocumento[];
  autorizaciones: FichaAlumnoAutorizacion[];
}

export interface RegistrarDocumentoAlumnoRequest {
  idctalumnofichadocumento: number;
  documentoNombre: string;
  documentoContentType?: string | null;
  documentoTamanoBytes?: number | null;
  documentoBase64?: string | null;
  observaciones?: string | null;
}

export interface ResponderAutorizacionAlumnoRequest {
  idctalumnofichaautorizacion: number;
  respuesta: 'ACEPTADO' | 'RECHAZADO' | 'REVOCADO';
  observaciones?: string | null;
}
