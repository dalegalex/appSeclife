import { Component, signal } from '@angular/core';
import { InfiniteScrollCustomEvent, SearchbarCustomEvent, SegmentCustomEvent, ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import {
  NotificacionPushHistorialFilters,
  NotificacionPushHistorialItem,
  NotificacionPushReadFilter,
} from '../../models/notificaciones-push.model';
import { NotificacionesPushRegistrationService } from '../../services/notificaciones-push-registration.service';
import { NotificacionesPushService } from '../../services/notificaciones-push.service';

const INITIAL_FILTERS: NotificacionPushHistorialFilters = {
  estado: '',
  texto: '',
  page: 1,
  pageSize: 20,
};

@Component({
  selector: 'app-historial-notificaciones',
  templateUrl: './historial-notificaciones.page.html',
  styleUrls: ['./historial-notificaciones.page.scss'],
  standalone: false,
})
export class HistorialNotificacionesPage {
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly notifications = signal<NotificacionPushHistorialItem[]>([]);
  readonly total = signal(0);
  readonly totalNoLeidas = signal(0);
  readonly markingAsRead = signal<ReadonlySet<number>>(new Set());
  readonly filters = signal<NotificacionPushHistorialFilters>({ ...INITIAL_FILTERS });

  constructor(
    private readonly service: NotificacionesPushService,
    private readonly registrationService: NotificacionesPushRegistrationService,
    private readonly toastController: ToastController
  ) {}

  ionViewWillEnter(): void {
    this.reload();
  }

  reload(): void {
    this.filters.update((filters) => ({ ...filters, page: 1 }));
    this.notifications.set([]);
    this.loadPage(false);
  }

  onSearch(event: SearchbarCustomEvent): void {
    this.filters.update((filters) => ({
      ...filters,
      texto: event.detail.value?.trim() ?? '',
      page: 1,
    }));
    this.notifications.set([]);
    this.loadPage(false);
  }

  onReadFilter(event: SegmentCustomEvent): void {
    const value = String(event.detail.value ?? '');
    const estado: NotificacionPushReadFilter =
      value === 'LEIDAS' || value === 'NO_LEIDAS' ? value : '';

    this.filters.update((filters) => ({ ...filters, estado, page: 1 }));
    this.notifications.set([]);
    this.loadPage(false);
  }

  loadMore(event: InfiniteScrollCustomEvent): void {
    if (this.loadingMore() || this.notifications().length >= this.total()) {
      void event.target.complete();
      return;
    }

    this.filters.update((filters) => ({ ...filters, page: filters.page + 1 }));
    this.loadPage(true, event);
  }

  async openNotification(item: NotificacionPushHistorialItem): Promise<void> {
    if (this.filters().estado === 'NO_LEIDAS') {
      await this.markAsReadFromUnreadTab(item);
      return;
    }

    await this.registrationService.openHistoryNotification(item.idnotificacion, item.dataJson);

    if (!item.leida) {
      this.notifications.update((items) => items.map((current) =>
        current.idnotificacion === item.idnotificacion
          ? { ...current, leida: true, fechaLeida: new Date().toISOString() }
          : current
      ));
      this.totalNoLeidas.update((count) => Math.max(0, count - 1));
      void this.registrationService.updateAppBadgeCount(this.totalNoLeidas());
    }
  }

  private async markAsReadFromUnreadTab(item: NotificacionPushHistorialItem): Promise<void> {
    if (this.markingAsRead().has(item.idnotificacion)) {
      return;
    }

    this.markingAsRead.update((ids) => new Set(ids).add(item.idnotificacion));

    try {
      const marked = await firstValueFrom(this.service.marcarLeida(item.idnotificacion));
      if (!marked) {
        throw new Error('La notificacion no fue marcada como leida.');
      }
      this.notifications.update((items) =>
        items.filter((current) => current.idnotificacion !== item.idnotificacion)
      );
      this.total.update((count) => Math.max(0, count - 1));
      this.totalNoLeidas.update((count) => Math.max(0, count - 1));
      await this.registrationService.updateAppBadgeCount(this.totalNoLeidas());
    } catch {
      const toast = await this.toastController.create({
        message: 'No fue posible marcar la notificacion como leida.',
        duration: 2500,
        position: 'bottom',
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.markingAsRead.update((ids) => {
        const nextIds = new Set(ids);
        nextIds.delete(item.idnotificacion);
        return nextIds;
      });
    }
  }

  formatDate(value: string): string {
    const normalizedValue = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
    const date = new Date(normalizedValue);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  moduleIcon(moduleName: string): string {
    const icons: Record<string, string> = {
      'transporte-escolar': 'bus-outline',
      'control-accesos': 'scan-outline',
      'asistencia-incidencias': 'document-text-outline',
      'academico-evaluaciones': 'school-outline',
    };

    return icons[moduleName] ?? 'notifications-outline';
  }

  private loadPage(append: boolean, infiniteEvent?: InfiniteScrollCustomEvent): void {
    if ((!append && this.loading()) || (append && this.loadingMore())) {
      void infiniteEvent?.target.complete();
      return;
    }

    if (append) {
      this.loadingMore.set(true);
    } else {
      this.loading.set(true);
    }
    this.errorMessage.set(null);

    const requestedFilters = { ...this.filters() };

    this.service.consultarHistorial(requestedFilters).subscribe({
      next: (page) => {
        this.total.set(page.total ?? 0);
        this.totalNoLeidas.set(page.totalNoLeidas ?? 0);
        void this.registrationService.updateAppBadgeCount(this.totalNoLeidas());
        this.filters.update((filters) => ({
          ...filters,
          page: page.page || requestedFilters.page,
          pageSize: page.pageSize || requestedFilters.pageSize,
        }));

        if (append) {
          const existingIds = new Set(this.notifications().map((item) => item.idnotificacion));
          this.notifications.update((items) => [
            ...items,
            ...(page.items ?? []).filter((item) => !existingIds.has(item.idnotificacion)),
          ]);
        } else {
          this.notifications.set(page.items ?? []);
        }
      },
      error: () => {
        if (!append) {
          this.notifications.set([]);
          this.total.set(0);
        }
        this.errorMessage.set('No fue posible consultar tus notificaciones.');
      },
      complete: () => {
        this.loading.set(false);
        this.loadingMore.set(false);
        void infiniteEvent?.target.complete();
      },
    });
  }
}
