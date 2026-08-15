import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { PushNotificationSchema, PushNotifications, Token } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { Device, DeviceInfo } from '@capacitor/device';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DRIVER_TRANSPORT_ENABLED } from '../../../core/platform/platform-capabilities';
import { environment } from '../../../../environments/environment';
import { setAppBadgeCount } from '../../../core/app-badge';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificacionesPushService } from './notificaciones-push.service';

const DEVICE_ID_KEY = 'seclife.mobile.push.deviceId';
const DEFAULT_NOTIFICATION_ROUTE = '/home';

@Injectable({
  providedIn: 'root',
})
export class NotificacionesPushRegistrationService {
  private initialized = false;
  private readonly platform = Capacitor.getPlatform();

  constructor(
    private readonly authService: AuthService,
    private readonly notificacionesPushService: NotificacionesPushService,
    private readonly router: Router,
    private readonly toastController: ToastController
  ) {}

  async registerCurrentDevice(): Promise<void> {
    if (this.initialized || !Capacitor.isNativePlatform() || !this.authService.isAuthenticated()) {
      return;
    }

    this.initialized = true;

    try {
      const permissionStatus = await PushNotifications.requestPermissions();

      if (permissionStatus.receive !== 'granted') {
        this.initialized = false;
        return;
      }

      await PushNotifications.addListener('registration', (token) => {
        void this.registerToken(token).catch((error) => this.logPushError('registration', error));
      });

      await PushNotifications.addListener('registrationError', (error) => {
        this.logPushError('registrationError', error);
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        void this.syncAppBadgeFromHistory();
        void this.presentForegroundNotification(notification).catch((error) =>
          this.logPushError('pushNotificationReceived', error)
        );
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        void this.openNotification(action.notification.data).catch((error) =>
          this.logPushError('pushNotificationActionPerformed', error)
        );
      });

      await PushNotifications.register();
      await this.syncAppBadgeFromHistory();
    } catch (error) {
      this.initialized = false;
      await PushNotifications.removeAllListeners();
      this.logPushError('registerCurrentDevice', error);
    }
  }

  async unregisterCurrentDevice(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const deviceId = localStorage.getItem(DEVICE_ID_KEY);

    try {
      if (deviceId) {
        await firstValueFrom(this.notificacionesPushService.bajaDispositivo(deviceId));
      }
    } catch (error) {
      this.logPushError('unregisterCurrentDevice', error);
    } finally {
      await this.setAppBadgeCountSafely(0);
      await PushNotifications.removeAllListeners();
      this.initialized = false;
    }
  }

  private async registerToken(token: Token): Promise<void> {
    if (this.platform === 'ios' && /^[a-f0-9]{64}$/i.test(token.value)) {
      throw new Error('Se recibio un token APNs en lugar de un token FCM; no se registrara en el backend.');
    }

    const deviceInfo = await this.getDeviceInfo();

    await firstValueFrom(
      this.notificacionesPushService.registrarDispositivo({
        token: token.value,
        platform: this.resolvePushPlatform(),
        app: 'appSeclife',
        deviceId: this.getOrCreateDeviceId(),
        appVersion: `${environment.appVersion}.${environment.appBuild}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
        manufacturer: deviceInfo?.manufacturer ?? null,
        model: deviceInfo?.model ?? null,
        operatingSystem: deviceInfo?.operatingSystem ?? null,
        osVersion: deviceInfo?.osVersion ?? null,
        androidSdkVersion: deviceInfo?.androidSDKVersion ?? null,
        isVirtual: deviceInfo?.isVirtual ?? null,
        webViewVersion: deviceInfo?.webViewVersion ?? null,
      })
    );

    await this.syncAppBadgeFromHistory();
  }

  async syncAppBadgeFromHistory(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      await this.setAppBadgeCountSafely(0);
      return;
    }

    try {
      const page = await firstValueFrom(this.notificacionesPushService.consultarHistorial({
        estado: 'NO_LEIDAS',
        texto: '',
        page: 1,
        pageSize: 1,
      }));
      await this.setAppBadgeCountSafely(page.totalNoLeidas ?? 0);
    } catch (error) {
      this.logPushError('syncAppBadgeFromHistory', error);
    }
  }

  async updateAppBadgeCount(count: number): Promise<void> {
    await this.setAppBadgeCountSafely(count);
  }

  async openHistoryNotification(idnotificacion: number, dataJson?: string | null): Promise<void> {
    let data: Record<string, unknown> = {};

    if (dataJson) {
      try {
        const parsed = JSON.parse(dataJson);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          data = parsed as Record<string, unknown>;
        }
      } catch (error) {
        this.logPushError('parseHistoryData', error);
      }
    }

    await this.openNotification({ ...data, idnotificacion });
  }

  private async presentForegroundNotification(notification: PushNotificationSchema): Promise<void> {
    const toast = await this.toastController.create({
      header: notification.title || 'Seclife School',
      message: notification.body || 'Tienes una nueva notificacion escolar.',
      duration: 7000,
      position: 'top',
      color: 'primary',
      buttons: [
        {
          text: 'Ver',
          handler: () => {
            void this.openNotification(notification.data);
          },
        },
        {
          icon: 'close',
          role: 'cancel',
        },
      ],
    });

    await toast.present();
  }

  private async openNotification(data?: Record<string, unknown>): Promise<void> {
    const notificationId = this.readPositiveNumber(data?.['idnotificacion']);

    if (notificationId) {
      try {
        await firstValueFrom(this.notificacionesPushService.marcarLeida(notificationId));
      } catch (error) {
        this.logPushError('marcarLeida', error);
      }
    }

    await this.syncAppBadgeFromHistory();

    await this.router.navigateByUrl(this.resolveNotificationRoute(data));
  }

  private resolveNotificationRoute(data?: Record<string, unknown>): string {
    const requestedRoute = this.readString(data?.['route']) ?? this.readString(data?.['ruta']);

    if (requestedRoute && this.isAllowedInternalRoute(requestedRoute)) {
      if (requestedRoute.startsWith('/transporte-escolar/conductor') && !DRIVER_TRANSPORT_ENABLED) {
        return '/home';
      }
      return requestedRoute;
    }

    const eventType = this.readString(data?.['tipoEvento'])?.toUpperCase() ?? '';
    const profileId = this.authService.getCurrentProfileId();

    if (eventType.startsWith('EVENTO_CONVOCATORIA_')) {
      return '/control-accesos/eventos';
    }

    if (eventType.startsWith('TRANSPORTE_')) {
      if (profileId === 10 || profileId === 11) {
        return DRIVER_TRANSPORT_ENABLED ? '/transporte-escolar/conductor' : '/home';
      }

      return '/transporte-escolar/padre';
    }

    if (eventType === 'ACCESO_ENTREGA_CARRUSEL') {
      return profileId && [1, 2, 3].includes(profileId)
        ? '/control-accesos/carrusel'
        : '/control-accesos/bitacora';
    }

    if (eventType.startsWith('ACCESO_')) {
      return profileId && [1, 2, 3].includes(profileId)
        ? '/control-accesos/lectura-asistida'
        : '/control-accesos/bitacora';
    }

    if ((eventType.startsWith('INCIDENCIA_') || eventType.startsWith('ASISTENCIA_'))
        && this.authService.hasFamilyAccess()) {
      return '/control-accesos/avisos-asistencia';
    }

    return DEFAULT_NOTIFICATION_ROUTE;
  }

  private isAllowedInternalRoute(route: string): boolean {
    if (!route.startsWith('/') || route.startsWith('//')) {
      return false;
    }

    const path = route.split(/[?#]/, 1)[0];
    const allowedRoots = [
      '/home',
      '/transporte-escolar',
      '/control-accesos',
      '/ficha-personal',
      '/ficha-alumno',
      '/notificaciones',
      '/cuenta',
    ];

    return allowedRoots.some((root) => path === root || path.startsWith(`${root}/`));
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private readPositiveNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private async getDeviceInfo(): Promise<DeviceInfo | null> {
    try {
      return await Device.getInfo();
    } catch (error) {
      this.logPushError('getDeviceInfo', error);
      return null;
    }
  }

  private async setAppBadgeCountSafely(count: number): Promise<void> {
    try {
      await setAppBadgeCount(count);
    } catch (error) {
      this.logPushError('setAppBadgeCount', error);
    }
  }

  private resolvePushPlatform(): 'android' | 'ios' | 'web' {
    if (this.platform === 'android' || this.platform === 'ios') {
      return this.platform;
    }

    return 'web';
  }

  private getOrCreateDeviceId(): string {
    const storedDeviceId = localStorage.getItem(DEVICE_ID_KEY);

    if (storedDeviceId) {
      return storedDeviceId;
    }

    const deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
  }

  private logPushError(context: string, error: unknown): void {
    console.warn(`[Push] ${context}`, error);
  }
}
