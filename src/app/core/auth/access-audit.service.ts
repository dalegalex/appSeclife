import { Injectable } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AccessAuditService {
  private readonly http: HttpClient;
  private readonly native = Capacitor.isNativePlatform();
  private readonly base = `${this.native ? environment.androidApiUrl : environment.apiUrl}/app-access/events`;
  private headers: Record<string, string> = {};
  private token: string | null = null;
  private lastActivity = 0;
  private pending: { eventId: string; event: string; clientUtc: string } | null = null;
  private inFlight = false;
  private generation = 0;

  constructor(backend: HttpBackend) {
    // Independent transport: telemetry failures must not trigger login locks or user error banners.
    this.http = new HttpClient(backend);
    if (!this.native) return;
    try {
      if (typeof crypto.randomUUID !== 'function') return;
      let installation = localStorage.getItem('seclife.audit.installation');
      if (!installation || !/^[0-9a-f-]{36}$/i.test(installation)) {
        installation = crypto.randomUUID();
        localStorage.setItem('seclife.audit.installation', installation);
      }
      this.headers = {
        'X-Seclife-Client': 'appSeclife',
        'X-Seclife-Installation': installation,
        'X-Seclife-Platform': Capacitor.getPlatform(),
        'X-Seclife-Version': environment.appVersion,
      };
      void Device.getInfo().then(info => {
        const clean = (value: string, length: number) => value.replace(/[^\x20-\x7e]/g, '').slice(0, length);
        this.headers['X-Seclife-Manufacturer'] = clean(info.manufacturer, 100);
        this.headers['X-Seclife-Model'] = clean(info.model, 200);
        this.headers['X-Seclife-System'] = clean(`${info.operatingSystem} ${info.osVersion}`, 80);
      }).catch(() => undefined);
      void App.getInfo().then(info => {
        this.headers['X-Seclife-Version'] = info.version.slice(0, 40);
        this.headers['X-Seclife-Build'] = info.build;
      }).catch(() => undefined);
      void App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) this.activity();
      }).catch(() => undefined);
    } catch { this.headers = {}; }
  }

  requestHeaders(url: string): Record<string, string> {
    const api = this.native ? environment.androidApiUrl : environment.apiUrl;
    return this.native && url.startsWith(`${api}/`) ? this.headers : {};
  }

  session(token: string | null): void {
    this.generation++;
    this.token = token;
    this.pending = null;
    this.inFlight = false;
    this.lastActivity = 0;
    if (token) this.activity();
  }

  logout(): void {
    if (this.token && this.headers['X-Seclife-Installation']) {
      this.http.post(this.base, { eventId: crypto.randomUUID(), event: 'CIERRE_SESION', clientUtc: new Date().toISOString() },
        { headers: { ...this.headers, Authorization: `Bearer ${this.token}` } }).pipe(timeout(5000))
        .subscribe({ error: () => undefined });
    }
    this.session(null);
  }

  private activity(): void {
    if (!this.token || !this.headers['X-Seclife-Installation'] || this.inFlight) return;
    if (!this.pending && Date.now() - this.lastActivity < 300_000) return;
    this.pending ??= { eventId: crypto.randomUUID(), event: 'ACTIVIDAD_RECIBIDA', clientUtc: new Date().toISOString() };
    const generation = this.generation;
    this.inFlight = true;
    this.http.post(this.base, this.pending, { headers: { ...this.headers, Authorization: `Bearer ${this.token}` } })
      .pipe(timeout(5000)).subscribe({
        next: () => {
          if (generation !== this.generation) return;
          this.pending = null; this.inFlight = false; this.lastActivity = Date.now();
        },
        error: () => {
          if (generation === this.generation) this.inFlight = false;
          // At most one in-memory event; retry on next foreground, never across identities.
        },
      });
  }
}
