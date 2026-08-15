import { Component, OnInit, computed, signal } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { DRIVER_TRANSPORT_ENABLED } from '../core/platform/platform-capabilities';
import { EventoInvitacionService } from '../modules/control-accesos/services/evento-invitacion.service';
import { NotificacionesPushRegistrationService } from '../modules/notificaciones-push/services/notificaciones-push-registration.service';
import { NotificacionesPushService } from '../modules/notificaciones-push/services/notificaciones-push.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  private readonly adminProfiles = [1, 2, 3];
  readonly organizationLogo = signal<string | null>(null);
  readonly organizationLogoContentType = signal<string | null>(null);
  readonly organizationLogoSrc = computed(() => this.resolveLogoSrc(this.organizationLogo(), this.organizationLogoContentType()));
  readonly pendingEventCount = signal(0);
  readonly unreadNotificationCount = signal(0);

  constructor(
    public readonly authService: AuthService,
    private readonly eventoInvitacionService: EventoInvitacionService,
    private readonly notificacionesPushRegistrationService: NotificacionesPushRegistrationService,
    private readonly notificacionesPushService: NotificacionesPushService
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    this.authService.getOrganizationBrand().subscribe({
      next: brand => {
        this.organizationLogo.set(brand.logoorg ?? null);
        this.organizationLogoContentType.set(brand.logoContentType ?? null);
      },
      error: () => {
        this.organizationLogo.set(null);
        this.organizationLogoContentType.set(null);
      },
    });
  }

  ionViewWillEnter(): void {
    this.authService.loadAppMenu(true).subscribe(() => {
      this.loadPendingEventCount();
      this.loadUnreadNotificationCount();
    });
  }

  canUseConductor(): boolean {
    return DRIVER_TRANSPORT_ENABLED
      && this.authService.canAccessAppRoute('/transporte-escolar/conductor')
      && this.isProfileAllowed([10, 11]);
  }

  canUsePadre(): boolean {
    return this.authService.canAccessAppRoute('/transporte-escolar/padre')
      && this.canUseFamilyAccess();
  }

  canUseControlAccesos(route: string): boolean {
    return this.authService.canAccessAppRoute(route) && this.isProfileAllowed([]);
  }

  canUseFichaPersonal(): boolean {
    return this.authService.canAccessAppRoute('/ficha-personal/mi-ficha')
      && this.isProfileAllowed([]);
  }

  canUseFichaAlumno(): boolean {
    return this.authService.canAccessAppRoute('/ficha-alumno/mis-alumnos')
      && this.canUseFamilyAccess();
  }

  canUseExpedienteDocumental(): boolean {
    return this.authService.canAccessAppRoute('/expediente-documental')
      && this.canUseFamilyAccess();
  }

  canUseRedFamiliar(route = '/control-accesos/red-familiar'): boolean {
    return this.authService.canAccessAppRoute(route) && this.canUseFamilyAccess();
  }

  canUseCredencialDigital(): boolean {
    return this.authService.canAccessAppRoute('/control-accesos/credencial-digital')
      && !!this.authService.getCurrentProfileId();
  }

  canUseNotifications(): boolean {
    return this.authService.canAccessAppRoute('/notificaciones/historial');
  }

  canUseHomeExtras(): boolean {
    return this.authService.canAccessAppRoute('/home');
  }

  reloadMenu(): void {
    this.ionViewWillEnter();
  }

  private isProfileAllowed(profiles: number[]): boolean {
    const profileId = this.authService.getCurrentProfileId();
    return !!profileId && [...profiles, ...this.adminProfiles].includes(profileId);
  }

  private canUseFamilyAccess(): boolean {
    return this.isProfileAllowed([4]) || this.authService.hasFamilyAccess();
  }

  private loadPendingEventCount(): void {
    if (!this.authService.isAuthenticated() || !this.canUseRedFamiliar('/control-accesos/eventos')) {
      this.pendingEventCount.set(0);
      return;
    }

    this.eventoInvitacionService.consultarMias().subscribe({
      next: invitations => {
        const pendingCount = invitations.filter(
          invitation => (invitation.estatusRespuesta ?? 'PENDIENTE').toUpperCase() === 'PENDIENTE'
        ).length;
        this.pendingEventCount.set(pendingCount);
      },
      error: () => this.pendingEventCount.set(0),
    });
  }

  private loadUnreadNotificationCount(): void {
    if (!this.authService.isAuthenticated() || !this.canUseNotifications()) {
      this.unreadNotificationCount.set(0);
      return;
    }

    this.notificacionesPushService.consultarHistorial({
      estado: 'NO_LEIDAS',
      texto: '',
      page: 1,
      pageSize: 1,
    }).subscribe({
      next: page => {
        this.unreadNotificationCount.set(page.totalNoLeidas ?? 0);
        void this.notificacionesPushRegistrationService.updateAppBadgeCount(this.unreadNotificationCount());
      },
      error: () => this.unreadNotificationCount.set(0),
    });
  }

  private resolveLogoSrc(logo: string | null, contentType: string | null): string | null {
    const value = logo?.trim();
    if (!value) {
      return null;
    }

    return value.startsWith('data:image/')
      ? value
      : `data:${contentType || 'image/png'};base64,${value}`;
  }
}
