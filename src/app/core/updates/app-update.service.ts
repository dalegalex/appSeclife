import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, NgZone, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UpdateDecision {
  status: 'CURRENT' | 'RECOMMENDED' | 'REQUIRED'; storeUrl: string;
  recommendedVersion: string; recommendedBuild: string; revision: number;
}

export function validStoreLink(platform: string, value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password) return false;
    return platform === 'android'
      ? value === 'https://play.google.com/store/apps/details?id=mx.com.seclife.schoolmaster'
      : platform === 'ios' && u.hostname === 'apps.apple.com' && /\/id\d+$/.test(u.pathname) && !u.search && !u.hash;
  } catch { return false; }
}

// Conservatively defer on operational screens; leaving them is the safe boundary.
export function operationalScreen(url: string): boolean {
  return /^\/(transporte-escolar\/conductor|control-accesos\/(lectura-asistida|lectura-autogestionada|carrusel|visitantes-proveedores))(\/|\?|$)/.test(url);
}

const locationPlugin = registerPlugin<{ status(): Promise<{ running: boolean }> }>('SeclifeBackgroundLocation');

@Injectable({ providedIn: 'root' })
export class AppVersionDevice {
  isNative(): boolean { return Capacitor.isNativePlatform(); }
  platform(): string { return Capacitor.getPlatform(); }
  async info(): Promise<{ version: string; build: string }> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([App.getInfo(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Native app information timed out')), 3000);
      })]);
    } finally { if (timer) clearTimeout(timer); }
  }
  hasGps(): boolean { return Capacitor.isPluginAvailable('SeclifeBackgroundLocation'); }
  gpsStatus(): Promise<{ running: boolean }> { return locationPlugin.status(); }
}

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly http: HttpClient;
  private started = false;
  private checking = false;
  private pendingTransport: () => boolean = () => false;
  private activeRequests = 0;
  private safetyGeneration = 0;
  private decision: UpdateDecision | null = null;
  private dismissedRevision: number | null = null;
  private nativeInfo: Promise<{ version: string; build: string }> | null = null;
  readonly blocked = signal(false);
  readonly recommended = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly installed = signal('');
  readonly available = signal('');
  readonly platform: string;
  readonly base: string;

  constructor(backend: HttpBackend, private readonly router: Router, private readonly zone: NgZone, private readonly device: AppVersionDevice) {
    this.http = new HttpClient(backend);
    this.platform = device.platform();
    this.base = device.isNative() ? environment.androidApiUrl : environment.apiUrl;
  }

  initialize(pendingTransport: () => boolean): void {
    if (this.started || !this.device.isNative()) return;
    this.started = true; this.pendingTransport = pendingTransport;
    this.router.events.subscribe(event => { if (event instanceof NavigationEnd) void this.refreshSafety(); });
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) this.zone.run(() => { void this.check(); });
    });
    window.addEventListener('online', () => void this.check());
    window.setInterval(() => void this.check(), 5 * 60_000);
    window.setInterval(() => { if (this.decision?.status === 'REQUIRED') void this.refreshSafety(); }, 15_000);
    void this.check();
  }

  async headers(): Promise<Record<string, string>> {
    if (!this.device.isNative()) return {};
    try {
      this.nativeInfo ??= this.device.info();
      const info = await this.nativeInfo;
      return { 'X-Seclife-Client': 'appSeclife', 'X-Seclife-Platform': this.platform,
        'X-Seclife-Version': info.version, 'X-Seclife-Build': info.build };
    } catch { this.nativeInfo = null; return {}; }
  }

  beginRequest(): void { this.activeRequests++; }
  endRequest(): void { this.activeRequests = Math.max(0, this.activeRequests - 1); void this.refreshSafety(); }

  async check(): Promise<void> {
    if (!this.device.isNative() || this.checking) return;
    this.checking = true; this.busy.set(true); this.error.set('');
    try {
      // Re-read after returning from the store. Never trust an environment label.
      const info = await this.device.info(); this.nativeInfo = Promise.resolve(info);
      this.installed.set(`${info.version} (${info.build})`);
      const params = new URLSearchParams({ platform: this.platform, version: info.version, build: info.build });
      const response = await firstValueFrom(this.http.get<{ result: UpdateDecision }>(`${this.base}/app-version/check?${params}`).pipe(timeout(8000)));
      const d = response.result;
      if (!d || !['CURRENT', 'RECOMMENDED', 'REQUIRED'].includes(d.status) ||
          (d.status !== 'CURRENT' && !validStoreLink(this.platform, d.storeUrl))) throw new Error('Invalid policy');
      this.decision = d;
      this.available.set(`${d.recommendedVersion} (${d.recommendedBuild})`);
      await this.refreshSafety();
    } catch {
      // Fail-open for a failed lookup, including a previously required policy: no outage lockout.
      this.decision = null; this.blocked.set(false); this.recommended.set(false);
      this.error.set('Problema de conectividad, intente mas tarde');
    } finally { this.checking = false; this.busy.set(false); }
  }

  async refreshSafety(): Promise<void> {
    const generation = ++this.safetyGeneration;
    const d = this.decision;
    if (!d || d.status === 'CURRENT') { this.blocked.set(false); this.recommended.set(false); return; }
    let protectedOperation = operationalScreen(this.router.url) || this.activeRequests > 0 || this.pendingTransport();
    if (!protectedOperation && this.platform === 'android' && this.device.hasGps()) {
      try {
        protectedOperation = (await Promise.race([
          this.device.gpsStatus(), new Promise<{ running: boolean }>(resolve => window.setTimeout(() => resolve({ running: true }), 2000))
        ])).running;
      } catch { protectedOperation = true; }
    }
    if (generation !== this.safetyGeneration || d !== this.decision) return;
    this.zone.run(() => {
      this.blocked.set(d.status === 'REQUIRED' && !protectedOperation);
      this.recommended.set(d.status === 'RECOMMENDED' && !protectedOperation && d.revision !== this.dismissedRevision);
    });
  }

  postpone(): void { this.dismissedRevision = this.decision?.revision ?? null; this.recommended.set(false); }
  onDismiss(): void { if (!this.blocked() && this.recommended()) this.postpone(); }
  openStore(): void {
    if (this.decision && validStoreLink(this.platform, this.decision.storeUrl)) {
      window.open(this.decision.storeUrl, '_blank', 'noopener,noreferrer');
    }
  }

  handleRequired(error: HttpErrorResponse): void {
    if (error.status === 426 && error.error?.code === 'APP_UPDATE_REQUIRED') void this.check();
  }
}
