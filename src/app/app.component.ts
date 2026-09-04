import { Component, effect, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../environments/environment';
import { AuthService } from './core/auth/auth.service';
import { SessionSecurityService } from './core/auth/session-security.service';
import { DRIVER_TRANSPORT_ENABLED } from './core/platform/platform-capabilities';
import { NotificacionesPushRegistrationService } from './modules/notificaciones-push/services/notificaciones-push-registration.service';

const PRIVACY_NOTICE_URL = 'https://seclifemx.com/aviso';
const PRIVACY_NOTICE_VERSION = '2026-08-13';
const PRIVACY_CONSENT_KEY_PREFIX = 'seclife.mobile.privacy.accepted';

interface AppMenuItem {
  title: string;
  subtitle: string;
  url: string;
  icon: string;
  enabled: boolean;
}

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  readonly appVersionLabel = `v${environment.appVersion} (${environment.appChannel})`;
  readonly privacyNoticeUrl = PRIVACY_NOTICE_URL;
  readonly privacyNoticeVersion = PRIVACY_NOTICE_VERSION;
  readonly canDismissPrivacyConsent = (): boolean => !this.privacyConsentRequired;
  readonly canDismissSessionLock = (): boolean => !this.sessionSecurity.locked();

  private readonly adminProfiles = [1, 2, 3];
  private readonly allMenuItems: AppMenuItem[] = [
    {
      title: 'Inicio',
      subtitle: 'Tablero de modulos',
      url: '/home',
      icon: 'home-outline',
      enabled: true,
    },
    {
      title: 'Notificaciones',
      subtitle: 'Avisos y preferencias',
      url: '/notificaciones/historial',
      icon: 'notifications-outline',
      enabled: true,
    },
    {
      title: 'Credencial Digital',
      subtitle: 'Identificacion escolar',
      url: '/control-accesos/credencial-digital',
      icon: 'id-card-outline',
      enabled: true,
    },
    {
      title: 'Mi ficha personal',
      subtitle: 'Datos y documentos',
      url: '/ficha-personal/mi-ficha',
      icon: 'person-circle-outline',
      enabled: true,
    },
    {
      title: 'Ficha del Alumno',
      subtitle: 'Datos y documentos del alumno',
      url: '/ficha-alumno/mis-alumnos',
      icon: 'school-outline',
      enabled: true,
    },
    {
      title: 'Expediente Documental',
      subtitle: 'Representacion y firma',
      url: '/expediente-documental',
      icon: 'document-lock-outline',
      enabled: true,
    },
    {
      title: 'Transporte Escolar',
      subtitle: 'Operacion de ruta',
      url: '/transporte-escolar/conductor',
      icon: 'bus-outline',
      enabled: true,
    },
    {
      title: 'Transporte Familiar',
      subtitle: 'Seguimiento de alumnos',
      url: '/transporte-escolar/padre',
      icon: 'people-outline',
      enabled: true,
    },
    {
      title: 'Red Familiar',
      subtitle: 'Familia, alumnos y autos',
      url: '/control-accesos/red-familiar',
      icon: 'people-circle-outline',
      enabled: true,
    },
    {
      title: 'Eventos familiares',
      subtitle: 'Pases sociales e invitaciones',
      url: '/control-accesos/red-familiar/eventos',
      icon: 'calendar-clear-outline',
      enabled: true,
    },
    {
      title: 'Eventos y Citas',
      subtitle: 'Invitaciones familiares',
      url: '/control-accesos/eventos',
      icon: 'calendar-number-outline',
      enabled: true,
    },
    {
      title: 'Bitacora de acceso',
      subtitle: 'Entradas y salidas',
      url: '/control-accesos/bitacora',
      icon: 'time-outline',
      enabled: true,
    },
    {
      title: 'Avisos de Asistencia',
      subtitle: 'Retardos y justificantes',
      url: '/control-accesos/avisos-asistencia',
      icon: 'document-text-outline',
      enabled: true,
    },
    {
      title: 'Control de Accesos',
      subtitle: 'Lectura asistida',
      url: '/control-accesos/lectura-asistida',
      icon: 'scan-outline',
      enabled: true,
    },
    {
      title: 'Lectura Autogestionada',
      subtitle: 'Eventos y asistencia',
      url: '/control-accesos/lectura-autogestionada',
      icon: 'qr-code-outline',
      enabled: true,
    },
    {
      title: 'Carrusel',
      subtitle: 'Punto de entrega',
      url: '/control-accesos/carrusel',
      icon: 'git-network-outline',
      enabled: true,
    },
    {
      title: 'Visor Carrusel',
      subtitle: 'Monitoreo de entregas',
      url: '/control-accesos/carrusel-visor',
      icon: 'eye-outline',
      enabled: true,
    },
    {
      title: 'Visitantes',
      subtitle: 'Pases y gafetes',
      url: '/control-accesos/visitantes-proveedores',
      icon: 'id-card-outline',
      enabled: true,
    },
    {
      title: 'Comunicados',
      subtitle: 'Proximamente',
      url: '/home',
      icon: 'chatbubbles-outline',
      enabled: false,
    },
    {
      title: 'Pagos',
      subtitle: 'Proximamente',
      url: '/home',
      icon: 'card-outline',
      enabled: false,
    },
  ];

  constructor(
    public readonly authService: AuthService,
    public readonly sessionSecurity: SessionSecurityService,
    private readonly router: Router,
    private readonly notificacionesPushRegistrationService: NotificacionesPushRegistrationService
  ) {
    void this.sessionSecurity.initialize();
    effect(() => {
      if (this.authService.isAuthenticated()) {
        untracked(() => {
          this.authService.loadAppMenu().subscribe();
          void this.notificacionesPushRegistrationService.registerCurrentDevice();
        });
      }
    });
  }

  get menuItems(): AppMenuItem[] {
    const profileId = this.authService.getCurrentProfileId();

    return this.allMenuItems.filter((item) => {
      if (!this.authService.canAccessAppRoute(item.url)) {
        return false;
      }

      if (item.url === '/transporte-escolar/conductor') {
        return DRIVER_TRANSPORT_ENABLED && this.isProfileAllowed(profileId, [10, 11]);
      }

      if (item.url === '/ficha-personal/mi-ficha') {
        return this.isProfileAllowed(profileId, []);
      }
      if (item.url === '/ficha-alumno/mis-alumnos') {
        return this.canUseFamilyAccess(profileId);
      }

      if (item.url === '/expediente-documental') {
        return this.canUseFamilyAccess(profileId);
      }

      if (item.url === '/transporte-escolar/padre') {
        return this.canUseFamilyAccess(profileId);
      }

      if (
        item.url === '/control-accesos/red-familiar' ||
        item.url === '/control-accesos/red-familiar/eventos' ||
        item.url === '/control-accesos/eventos'
      ) {
        return this.canUseFamilyAccess(profileId);
      }

      if (item.url === '/control-accesos/bitacora') {
        return this.canUseFamilyAccess(profileId);
      }
      if (item.url === '/control-accesos/avisos-asistencia') {
        return this.canUseFamilyAccess(profileId);
      }

      if (item.url === '/control-accesos/lectura-asistida') {
        return this.isProfileAllowed(profileId, []);
      }

      if (item.url === '/control-accesos/lectura-autogestionada') {
        return this.isProfileAllowed(profileId, []);
      }

      if (item.url === '/control-accesos/carrusel') {
        return this.isProfileAllowed(profileId, []);
      }

      if (item.url === '/control-accesos/carrusel-visor') {
        return this.isProfileAllowed(profileId, []);
      }

      if (item.url === '/control-accesos/visitantes-proveedores') {
        return this.isProfileAllowed(profileId, []);
      }

      return true;
    });
  }

  get userPhoto(): string | null {
    return this.authService.getCurrentUser()?.googlePicture ?? null;
  }

  get userEmail(): string {
    return this.authService.getCurrentUser()?.email ?? '';
  }

  get privacyConsentRequired(): boolean {
    return this.authService.isAuthenticated()
      && !this.authService.isSupportSession()
      && !this.hasAcceptedCurrentPrivacyNotice();
  }

  acceptPrivacyNotice(): void {
    const key = this.getPrivacyConsentKey();

    if (!key) {
      return;
    }

    const evidence = {
      acceptedAt: new Date().toISOString(),
      noticeVersion: this.privacyNoticeVersion,
      noticeUrl: this.privacyNoticeUrl,
      userId: this.authService.getCurrentUserId(),
      email: this.userEmail || null,
    };

    localStorage.setItem(key, JSON.stringify(evidence));
  }

  openPrivacyNotice(): void {
    window.open(this.privacyNoticeUrl, '_blank', 'noopener,noreferrer');
  }

  signOut(): void {
    void this.notificacionesPushRegistrationService.unregisterCurrentDevice();
    this.sessionSecurity.reset();
    this.authService.signOut();
    this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }

  private isProfileAllowed(profileId: number | null, profiles: number[]): boolean {
    return !!profileId && [...profiles, ...this.adminProfiles].includes(profileId);
  }

  private canUseFamilyAccess(profileId: number | null): boolean {
    return this.isProfileAllowed(profileId, [4]) || this.authService.hasFamilyAccess();
  }

  private hasAcceptedCurrentPrivacyNotice(): boolean {
    const key = this.getPrivacyConsentKey();

    if (!key) {
      return false;
    }

    const raw = localStorage.getItem(key);

    if (!raw) {
      return false;
    }

    try {
      const acceptance = JSON.parse(raw) as { noticeVersion?: string | null };
      return acceptance.noticeVersion === this.privacyNoticeVersion;
    } catch {
      localStorage.removeItem(key);
      return false;
    }
  }

  private getPrivacyConsentKey(): string | null {
    const user = this.authService.getCurrentUser();
    const userKey = user?.idusrbt ?? user?.email ?? null;

    return userKey ? `${PRIVACY_CONSENT_KEY_PREFIX}.${userKey}` : null;
  }
}
