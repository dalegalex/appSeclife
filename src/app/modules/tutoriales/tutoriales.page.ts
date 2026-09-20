import { Component, ElementRef, HostListener, OnDestroy, ViewChild, effect, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { IonicModule, InfiniteScrollCustomEvent, SearchbarCustomEvent, SelectCustomEvent } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { SessionLockStateService } from '../../core/auth/session-lock-state.service';
import { Tutorial, TutorialesService, PlaybackLink } from './tutoriales.service';

@Component({
  selector: 'app-tutoriales', standalone: true, imports: [IonicModule, ReactiveFormsModule],
  templateUrl: './tutoriales.page.html', styleUrl: './tutoriales.page.scss'
})
export class TutorialesPage implements OnDestroy {
  private readonly service = inject(TutorialesService);
  private readonly auth = inject(AuthService);
  private readonly lock = inject(SessionLockStateService);
  readonly filters = inject(FormBuilder).nonNullable.group({ buscar: '', categoria: '' });
  readonly rows = signal<Tutorial[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly allowed = signal(false);
  readonly more = signal(false);
  readonly selected = signal<Tutorial | null>(null);
  readonly link = signal<PlaybackLink | null>(null);
  readonly playerError = signal('');
  readonly preparing = signal(false);
  @ViewChild('video') video?: ElementRef<HTMLVideoElement>;
  private generation = 0;
  private playbackGeneration = 0;
  private offset = 0;
  private search = '';
  private category = '';
  private position = 0;
  private renewed = false;
  private active = false;

  constructor() {
    effect(() => { if (this.lock.locked()) this.close(); });
  }
  async ionViewWillEnter() {
    this.active = true;
    const generation = ++this.generation;
    this.allowed.set(false);
    await firstValueFrom(this.auth.loadAppMenu(true));
    if (!this.active || generation !== this.generation) return;
    this.allowed.set(this.auth.canAccessAppRoute('/ayuda/tutoriales'));
    if (!this.allowed()) { this.rows.set([]); this.error.set('No tienes acceso a Videotutoriales.'); return; }
    await this.reload();
  }
  async reload() {
    if (!this.allowed()) return;
    this.generation++; this.offset = 0; this.rows.set([]); this.loading.set(false);
    const filters = this.filters.getRawValue();
    this.search = filters.buscar.trim(); this.category = filters.categoria;
    this.error.set(''); this.more.set(true); await this.load();
  }
  onSearch(event: SearchbarCustomEvent) {
    this.filters.controls.buscar.setValue(event.detail.value ?? '');
    void this.reload();
  }
  onCategory(event: SelectCustomEvent) {
    this.filters.controls.categoria.setValue(String(event.detail.value ?? ''));
    void this.reload();
  }
  async load(event?: InfiniteScrollCustomEvent) {
    if (!this.allowed() || this.loading() || !this.more()) { await event?.target.complete(); return; }
    const generation = this.generation;
    this.loading.set(true); this.error.set('');
    try {
      const rows = await firstValueFrom(this.service.list(this.offset, this.search, this.category));
      if (!this.active || generation !== this.generation) return;
      this.offset += rows.length;
      this.rows.update(old => [...old, ...rows.filter(r => !old.some(o => o.id === r.id))]);
      this.more.set(rows.length === 20);
    } catch (e) {
      if (generation === this.generation) this.error.set(this.message(e));
    } finally {
      if (generation === this.generation) this.loading.set(false);
      await event?.target.complete();
    }
  }
  async open(row: Tutorial) {
    this.close(); this.selected.set(row); this.position = 0; this.renewed = false;
    await this.prepare();
  }
  async prepare() {
    const row = this.selected();
    if (!row || this.preparing() || this.lock.locked()) return;
    const generation = ++this.playbackGeneration;
    this.preparing.set(true); this.playerError.set(''); this.link.set(null);
    try {
      const link = await firstValueFrom(this.service.playback(row.id));
      if (!this.active || generation !== this.playbackGeneration) return;
      const url = new URL(link.url);
      if (url.protocol !== 'https:' || !url.hostname.endsWith('.blob.core.windows.net') ||
          !url.pathname.startsWith('/seclife-tutoriales/') || !Number.isFinite(Date.parse(link.expiresAt)))
        throw new Error('Enlace de video no valido.');
      this.link.set(link);
    } catch (e) {
      if (generation === this.playbackGeneration) this.playerError.set(this.message(e));
    } finally { if (generation === this.playbackGeneration) this.preparing.set(false); }
  }
  rememberPosition() { if (this.video) this.position = this.video.nativeElement.currentTime || 0; }
  metadata() {
    const video = this.video?.nativeElement;
    if (video && this.position > 0) video.currentTime = Math.min(this.position, Math.max(0, video.duration - 0.1));
  }
  async playbackError() {
    this.rememberPosition();
    const link = this.link();
    if (link && Date.now() >= Date.parse(link.expiresAt) - 5000 && !this.renewed) {
      this.renewed = true; await this.prepare(); return;
    }
    this.playerError.set('No fue posible reproducir el video. Revisa tu conexion e intenta nuevamente.');
  }
  async checkExpiry() {
    const link = this.link();
    if (link && Date.now() >= Date.parse(link.expiresAt) - 5000) {
      this.rememberPosition(); this.video?.nativeElement.pause();
      if (!this.renewed) { this.renewed = true; await this.prepare(); }
      else this.playerError.set('El enlace vencio. Pulsa Reintentar para continuar.');
    }
  }
  async retryPlayback() { this.rememberPosition(); this.video?.nativeElement.pause(); this.renewed = false; await this.prepare(); }
  close() {
    this.playbackGeneration++; this.video?.nativeElement.pause(); this.link.set(null);
    this.selected.set(null); this.playerError.set(''); this.preparing.set(false);
  }
  ionViewWillLeave() { this.active = false; this.generation++; this.close(); }
  ngOnDestroy() { this.ionViewWillLeave(); }
  @HostListener('document:visibilitychange')
  visibilityChanged() { if (document.hidden) this.video?.nativeElement.pause(); }
  duration(seconds: number) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }
  categoryLabel(value: string) { return ({ RED_FAMILIAR: 'Red familiar', ASISTENCIA: 'Avisos de asistencia', EVENTOS_FAMILIARES: 'Eventos familiares' } as Record<string, string>)[value] ?? value; }
  private message(e: unknown) {
    const error = e as { status?: number; error?: { message?: string }; message?: string };
    if (error.status === 0) return 'Sin conexion con Seclife. Revisa WiFi o datos moviles.';
    if (error.status === 404) return 'Este tutorial ya no esta disponible para tu cuenta.';
    return error.error?.message || 'No fue posible consultar el material. Intenta nuevamente.';
  }
}
