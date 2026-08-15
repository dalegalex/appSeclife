import { Component, computed, signal } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { finalize } from 'rxjs';
import { NotificacionPushPreferencia } from '../../models/notificaciones-push.model';
import { NotificacionesPushService } from '../../services/notificaciones-push.service';

interface PreferenciaGrupo {
  key: string;
  title: string;
  icon: string;
  items: NotificacionPushPreferencia[];
}

const GROUP_METADATA: Record<string, { title: string; icon: string; order: number }> = {
  'transporte-escolar': { title: 'Transporte escolar', icon: 'bus-outline', order: 1 },
  'control-accesos': { title: 'Control de accesos', icon: 'scan-outline', order: 2 },
  'asistencia-incidencias': { title: 'Asistencia e incidencias', icon: 'document-text-outline', order: 3 },
  'academico-evaluaciones': { title: 'Academico y evaluaciones', icon: 'school-outline', order: 4 },
};

@Component({
  selector: 'app-preferencias-notificaciones',
  templateUrl: './preferencias-notificaciones.page.html',
  styleUrls: ['./preferencias-notificaciones.page.scss'],
  standalone: false,
})
export class PreferenciasNotificacionesPage {
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly preferences = signal<NotificacionPushPreferencia[]>([]);
  readonly savingEvents = signal<ReadonlySet<string>>(new Set());

  readonly groups = computed<PreferenciaGrupo[]>(() => {
    const grouped = new Map<string, NotificacionPushPreferencia[]>();

    for (const preference of this.preferences()) {
      const items = grouped.get(preference.moduloOrigen) ?? [];
      items.push(preference);
      grouped.set(preference.moduloOrigen, items);
    }

    return Array.from(grouped.entries())
      .map(([key, items]) => {
        const metadata = GROUP_METADATA[key] ?? {
          title: this.formatGroupName(key),
          icon: 'notifications-outline',
          order: 99,
        };

        return {
          key,
          title: metadata.title,
          icon: metadata.icon,
          items: [...items].sort((left, right) => left.descripcion.localeCompare(right.descripcion, 'es')),
          order: metadata.order,
        };
      })
      .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title, 'es'))
      .map(({ order: _order, ...group }) => group);
  });

  readonly activeCount = computed(() => this.preferences().filter((item) => item.activo).length);

  constructor(
    private readonly notificacionesPushService: NotificacionesPushService,
    private readonly toastController: ToastController
  ) {}

  ionViewWillEnter(): void {
    this.loadPreferences();
  }

  loadPreferences(): void {
    if (this.loading() && this.preferences().length > 0) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.notificacionesPushService.consultarPreferencias()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (preferences) => this.preferences.set(preferences),
        error: () => this.errorMessage.set('No fue posible consultar tus preferencias.'),
      });
  }

  togglePreference(preference: NotificacionPushPreferencia, active: boolean): void {
    if (preference.activo === active || this.isSaving(preference.tipoEvento)) {
      return;
    }

    this.setSaving(preference.tipoEvento, true);

    this.notificacionesPushService.guardarPreferencias([{
      idmatricula: preference.idmatricula,
      tipoEvento: preference.tipoEvento,
      activo: active,
    }])
      .pipe(finalize(() => this.setSaving(preference.tipoEvento, false)))
      .subscribe({
        next: async () => {
          this.preferences.update((items) => items.map((item) =>
            item.tipoEvento === preference.tipoEvento && item.idmatricula === preference.idmatricula
              ? { ...item, activo: active }
              : item
          ));
          await this.showToast(active ? 'Notificacion activada.' : 'Notificacion desactivada.');
        },
        error: async () => {
          this.preferences.update((items) => [...items]);
          await this.showToast('No fue posible guardar la preferencia.', 'danger');
        },
      });
  }

  isSaving(eventType: string): boolean {
    return this.savingEvents().has(eventType);
  }

  private setSaving(eventType: string, saving: boolean): void {
    this.savingEvents.update((current) => {
      const next = new Set(current);
      if (saving) {
        next.add(eventType);
      } else {
        next.delete(eventType);
      }
      return next;
    });
  }

  private formatGroupName(value: string): string {
    return value
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private async showToast(message: string, color?: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2200,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
