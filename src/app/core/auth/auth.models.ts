export interface AuthUser {
  idtag: number;
  idusrbt: number;
  idperfil: number;
  idorg: number;
  idfamilia?: number | null;
  idfamiliamiembro?: number | null;
  perfil: string;
  usr?: string | null;
  nombre?: string | null;
  apellidos?: string | null;
  email?: string | null;
  googleName?: string | null;
  googlePicture?: string | null;
  codereg?: string | null;
  rfid?: string | null;
  sitbloqueo: boolean;
  sitactivo: boolean;
}

export interface SupportSessionContext {
  supportSessionId: number;
  supportSessionUid: string;
  supportRequestId: number;
  actorIdusrbt: number;
  actorNombre?: string | null;
  subjectIdusrbt: number;
  subjectNombre?: string | null;
  scope: 'APPSECLIFE_READONLY' | string;
  expiresAt: string;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: AuthUser;
  support?: SupportSessionContext | null;
}

export interface EndSupportSessionResponse {
  finalizada: boolean;
  message: string;
}

export interface GoogleLoginRequest {
  idToken: string;
}

export interface RegisterWithCodeRequest {
  codereg: string;
  idToken: string;
  identidad?: number | null;
  idperfil?: number | null;
  nombre?: string | null;
  apellidos?: string | null;
  nombreFamilia?: string | null;
  cel?: string | null;
}

export interface LocalLoginStartRequest {
  email: string;
}

export interface LocalRegisterStartRequest {
  codereg: string;
  email: string;
  identidad?: number | null;
  idperfil?: number | null;
  nombre?: string | null;
  apellidos?: string | null;
  nombreFamilia?: string | null;
  cel?: string | null;
}

export interface LocalAuthVerifyRequest {
  email: string;
  codigo: string;
}

export interface LocalAuthStartResponse {
  message: string;
  expiresAt: string;
  codigoPrueba?: string | null;
}

export interface BiometricCredentialEnrollRequest {
  deviceUid: string;
  platform: 'ANDROID' | 'IOS';
  deviceModel?: string | null;
  operatingSystem?: string | null;
  appVersion?: string | null;
}

export interface BiometricCredentialEnrollResponse {
  deviceUid: string;
  credential: string;
  expiresAt: string;
}

export interface BiometricLoginRequest {
  deviceUid: string;
  credential: string;
}

export interface BiometricCapability {
  available: boolean;
  configured: boolean;
  deviceCredentialAvailable: boolean;
  label: string;
  reason: string | null;
}

export interface RegistrationCodePreview {
  codereg?: string | null;
  idtag: number;
  identidad: number;
  idorg: number;
  idperfil: number;
  perfil: string;
  nombre?: string | null;
  apellidos?: string | null;
  cel?: string | null;
  email?: string | null;
  sitbloqueo: boolean;
  sitactivo: boolean;
  requiereDatos: boolean;
  organizaciones: RegistrationCodeOrganization[];
  usuarios: RegistrationCodeUser[];
}

export interface RegistrationCodeOrganization {
  idorg: number;
  organizacion?: string | null;
}

export interface AccountDeletionRequest {
  motivo?: string | null;
  origen: 'APPSECLIFE' | 'WEB';
}

export interface AccountDeletionResponse {
  idsolicitud: number;
  folio: string;
  estatus: string;
  alcance: string;
  fechaSolicitud: string;
  fechaLimiteAtencion: string;
  solicitudActiva: boolean;
  message: string;
}

export interface AuthOrganizationBrand {
  idorg: number;
  logoorg?: string | null;
  logoContentType?: string | null;
}

export interface AuthMenuItem {
  idmenu: number;
  canal: 'WEB' | 'APP' | string;
  clave: string;
  titulo: string;
  descripcion?: string | null;
  icono?: string | null;
  ruta?: string | null;
  orden: number;
  puedever: boolean;
  puedecrear: boolean;
  puedeeditar: boolean;
  puedeeliminar: boolean;
  puedeejecutar: boolean;
  children: AuthMenuItem[];
}

export interface RegistrationCodeUser {
  identidad: number;
  idperfil: number;
  idtag: number;
  nombre?: string | null;
  apellidos?: string | null;
  cel?: string | null;
  email?: string | null;
}
