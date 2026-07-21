import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ConductorAlumno } from '../models/conductor-ruta.model';
import { ConductorRutasService } from './conductor-rutas.service';
import { nowMexicoSql } from './transporte-date.util';

type OfflineItemStatus = 'PENDIENTE' | 'SINCRONIZADO' | 'ERROR';
type OfflineItemType = 'ALUMNO_EVENTO' | 'GPS';

export interface OfflineAlumnoEventoPayload {
  idrecorrido: number;
  alumno: ConductorAlumno;
  tipoEvento: 'SUBE' | 'BAJA' | 'AUSENTE' | 'INCIDENCIA';
  latitud?: number | null;
  longitud?: number | null;
}

export interface OfflineGpsPayload {
  idrecorrido?: number | null;
  idruta: number;
  idunidad: number;
  latitud: number;
  longitud: number;
  precisionMetros?: number | null;
}

export interface OfflineSyncItem {
  clientEventId: string;
  type: OfflineItemType;
  status: OfflineItemStatus;
  createdAt: string;
  attempts: number;
  lastError?: string | null;
  payload: OfflineAlumnoEventoPayload | OfflineGpsPayload;
}

@Injectable({
  providedIn: 'root',
})
export class TransporteOfflineSyncService {
  private readonly storageKey = 'seclife.transporte.offlineQueue.v1';
  private readonly pendingCountSubject = new BehaviorSubject<number>(0);
  readonly pendingCount$ = this.pendingCountSubject.asObservable();
  private syncing = false;

  constructor(private readonly rutasService: ConductorRutasService) {
    this.refreshPendingCount();
    window.addEventListener('online', () => {
      void this.syncPending();
    });
  }

  enqueueAlumnoEvento(payload: OfflineAlumnoEventoPayload): OfflineSyncItem {
    const item: OfflineSyncItem = {
      clientEventId: crypto.randomUUID(),
      type: 'ALUMNO_EVENTO',
      status: 'PENDIENTE',
      createdAt: this.nowLocalSql(),
      attempts: 0,
      payload,
    };

    this.saveQueue([...this.loadQueue(), item]);
    return item;
  }

  enqueueGps(payload: OfflineGpsPayload): OfflineSyncItem {
    const item: OfflineSyncItem = {
      clientEventId: crypto.randomUUID(),
      type: 'GPS',
      status: 'PENDIENTE',
      createdAt: this.nowLocalSql(),
      attempts: 0,
      payload,
    };

    this.saveQueue([...this.loadQueue(), item]);
    return item;
  }

  hasPending(): boolean {
    return this.loadQueue().some((item) => item.status !== 'SINCRONIZADO');
  }

  pendingCount(): number {
    return this.loadQueue().filter((item) => item.status !== 'SINCRONIZADO').length;
  }

  hasClientEvent(clientEventId: string): boolean {
    return this.loadQueue().some((item) => item.clientEventId === clientEventId && item.status !== 'SINCRONIZADO');
  }

  async syncPending(): Promise<void> {
    if (this.syncing) {
      return;
    }

    this.syncing = true;
    const queue = this.loadQueue();

    for (const item of queue.filter((entry) => entry.status !== 'SINCRONIZADO')) {
      item.attempts += 1;

      try {
        const response = item.type === 'ALUMNO_EVENTO'
          ? await this.syncAlumnoEvento(item)
          : await this.syncGps(item);

        if (response.codeNumber === 0) {
          item.status = 'ERROR';
          item.lastError = response.message || 'No fue posible sincronizar.';
        } else {
          item.status = 'SINCRONIZADO';
          item.lastError = null;
        }
      } catch (error) {
        item.status = 'ERROR';
        item.lastError = error instanceof Error ? error.message : String(error);
      }
    }

    this.saveQueue(queue.filter((item) => item.status !== 'SINCRONIZADO'));
    this.syncing = false;
  }

  private syncAlumnoEvento(item: OfflineSyncItem) {
    const payload = item.payload as OfflineAlumnoEventoPayload;
    return firstValueFrom(this.rutasService.registrarEventoAlumno(
      payload.idrecorrido,
      payload.alumno,
      payload.tipoEvento,
      payload.latitud,
      payload.longitud,
      item.clientEventId,
      item.createdAt
    ));
  }

  private syncGps(item: OfflineSyncItem) {
    const payload = item.payload as OfflineGpsPayload;
    return firstValueFrom(this.rutasService.registrarGps(
      payload.idrecorrido,
      payload.idruta,
      payload.idunidad,
      payload.latitud,
      payload.longitud,
      item.clientEventId,
      item.createdAt,
      payload.precisionMetros
    ));
  }

  private loadQueue(): OfflineSyncItem[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as OfflineSyncItem[];
    } catch {
      return [];
    }
  }

  private saveQueue(queue: OfflineSyncItem[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(queue));
    this.refreshPendingCount();
  }

  private refreshPendingCount(): void {
    const nextCount = this.pendingCount();
    if (this.pendingCountSubject.value !== nextCount) {
      this.pendingCountSubject.next(nextCount);
    }
  }

  private nowLocalSql(): string {
    return nowMexicoSql();
  }
}
