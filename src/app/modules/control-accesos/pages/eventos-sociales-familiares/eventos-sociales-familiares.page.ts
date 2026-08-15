import { Component, OnInit } from '@angular/core';
import {
  CapacitorBarcodeScanner,
  CapacitorBarcodeScannerCameraDirection,
  CapacitorBarcodeScannerScanOrientation,
  CapacitorBarcodeScannerTypeHint,
} from '@capacitor/barcode-scanner';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import QRCode from 'qrcode';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { EventoFamiliarAlumno, EventoFamiliarPase, EventoFamiliarRespuesta, EventoFamiliarSocial, GuardarEventoFamiliarSocialRequest } from '../../models/evento-familiar-social.model';
import { MiembroFamiliar, RedFamiliarRow } from '../../models/red-familiar.model';
import { EventoFamiliarSocialService } from '../../services/evento-familiar-social.service';
import { RedFamiliarService } from '../../services/red-familiar.service';

@Component({
  selector: 'app-eventos-sociales-familiares',
  templateUrl: './eventos-sociales-familiares.page.html',
  styleUrls: ['./eventos-sociales-familiares.page.scss'],
  standalone: false,
})
export class EventosSocialesFamiliaresPage implements OnInit {
  loading = false;
  saving = false;
  showForm = false;
  rows: RedFamiliarRow[] = [];
  eventos: EventoFamiliarSocial[] = [];
  eventoInvitado: EventoFamiliarSocial | null = null;
  pase: EventoFamiliarPase | null = null;
  paseQr = '';
  eventoRespuestas: EventoFamiliarSocial | null = null;
  respuestas: EventoFamiliarRespuesta[] = [];
  loadingRespuestas = false;
  codigo = '';
  form = this.createForm();

  constructor(
    private readonly auth: AuthService,
    private readonly redService: RedFamiliarService,
    private readonly eventosService: EventoFamiliarSocialService,
    private readonly toast: ToastController,
  ) {}

  ngOnInit(): void { this.cargar(); }
  ionViewWillEnter(): void { this.cargarEventos(); }

  get idorg(): number { return this.auth.getCurrentUser()?.idorg ?? 0; }
  get idfamilia(): number { return this.rows.find(r => !!r.idfamilia)?.idfamilia ?? 0; }
  get familiares(): MiembroFamiliar[] {
    const map = new Map<number, MiembroFamiliar>();
    this.rows.flatMap(r => r.miembros ?? []).forEach(m => map.set(m.idfamiliamiembro, m));
    return [...map.values()];
  }
  get anfitriones(): MiembroFamiliar[] { return this.familiares.filter(m => m.sitactivo !== false && !!m.puedeRecoger && !!m.idusrbt); }

  cargar(): void {
    if (!this.idorg) return;
    this.loading = true;
    this.redService.consultarMiRed(this.idorg).subscribe({
      next: rows => {
        this.rows = rows;
        const master = this.anfitriones.find(m => m.esMaster) ?? this.anfitriones[0];
        this.form.idfamiliamiembroAnfitrion = master?.idfamiliamiembro ?? 0;
        this.cargarEventos();
      },
      error: e => { this.loading = false; this.present(e.message, 'danger'); },
    });
  }

  cargarEventos(): void {
    if (!this.idorg) return;
    this.eventosService.consultar(this.idorg).subscribe({
      next: eventos => { this.eventos = eventos; this.loading = false; },
      error: e => { this.loading = false; this.present(e.message, 'danger'); },
    });
  }

  nueva(): void { this.form = this.createForm(); this.showForm = true; this.pase = null; }
  cerrarForm(): void { this.showForm = false; }

  guardar(): void {
    if (!this.idfamilia || !this.form.idfamiliamiembroAnfitrion) return void this.present('Selecciona la familia y la persona anfitriona.', 'warning');
    this.saving = true;
    this.eventosService.guardar({ ...this.form, idorg: this.idorg, idfamilia: this.idfamilia }).subscribe({
      next: evento => {
        this.saving = false; this.showForm = false; this.present('Evento familiar guardado.', 'success');
        this.cargarEventos();
        this.publicar(evento);
      },
      error: e => { this.saving = false; this.present(e.message, 'danger'); },
    });
  }

  publicar(evento: EventoFamiliarSocial): void {
    this.eventosService.publicar(evento.ideventofamiliar, this.idorg).subscribe({
      next: async pase => {
        this.pase = pase;
        this.paseQr = await QRCode.toDataURL(`seclife://evento-familiar/${pase.tokenUid}`, { width: 480, margin: 2 });
        this.present('Pase de evento familiar emitido.', 'success');
        this.cargarEventos();
      },
      error: e => this.present(e.message, 'danger'),
    });
  }

  async consultarPase(evento: EventoFamiliarSocial): Promise<void> {
    if (!evento.esAnfitrion || !evento.tokenUid) {
      await this.present('El evento no tiene un pase vigente disponible.', 'warning');
      return;
    }

    if (!evento.codigo) {
      this.loading = true;
      this.eventosService.publicar(evento.ideventofamiliar, this.idorg).subscribe({
        next: async pase => {
          this.loading = false;
          await this.mostrarPase(pase);
          this.cargarEventos();
        },
        error: error => {
          this.loading = false;
          this.present(error.message, 'danger');
        },
      });
      return;
    }

    await this.mostrarPase({
      ideventofamiliar: evento.ideventofamiliar,
      nombre: evento.nombre,
      familiaAnfitriona: evento.familiaAnfitriona,
      fechaEvento: evento.fechaEvento,
      ubicacionGeneral: evento.ubicacionGeneral,
      codigo: evento.codigo,
      tokenUid: evento.tokenUid,
      leyenda: 'Favor de confirmar la asistencia a traves de Seclife movil',
    });
  }

  private async mostrarPase(pase: EventoFamiliarPase): Promise<void> {
    this.pase = pase;
    this.paseQr = await QRCode.toDataURL(`seclife://evento-familiar/${pase.tokenUid}`, { width: 480, margin: 2 });
    requestAnimationFrame(() => document.querySelector('.pass-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async compartirPase(): Promise<void> {
    if (!this.pase) return;

    const title = `Seclife - ${this.pase.nombre}`;
    const text = [
      this.pase.familiaAnfitriona || 'Familia anfitriona',
      this.pase.nombre,
      this.pase.fechaEvento ? `Fecha: ${this.pase.fechaEvento}` : '',
      `Lugar: ${this.pase.ubicacionGeneral || 'Domicilio particular'}`,
      `Codigo: ${this.pase.codigo}`,
      this.pase.leyenda,
    ].filter(Boolean).join('\n');

    try {
      if (Capacitor.isNativePlatform()) {
        const files = this.paseQr ? [await this.guardarQrTemporal(this.pase.codigo, this.paseQr)] : undefined;
        await Share.share({
          title,
          text,
          files,
          dialogTitle: 'Compartir pase de evento familiar',
        });
        return;
      }

      if (navigator.share) {
        const shareData: ShareData = { title, text };
        if (this.paseQr) {
          const qrFile = await this.crearQrFile(this.pase.codigo, this.paseQr);
          const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
          if (!nav.canShare || nav.canShare({ files: [qrFile] })) shareData.files = [qrFile];
        }
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(text);
      await this.present('Pase copiado para compartir.', 'success');
    } catch (error) {
      if (this.shareWasCanceled(error)) return;
      try {
        await navigator.clipboard?.writeText(text);
        await this.present('No fue posible abrir las opciones; el pase fue copiado.', 'warning');
      } catch {
        await this.present('No fue posible compartir el pase.', 'danger');
      }
    }
  }

  private async guardarQrTemporal(codigo: string, dataUrl: string): Promise<string> {
    const result = await Filesystem.writeFile({
      path: `seclife-evento-familiar-${codigo}.png`,
      data: dataUrl.split(',')[1] ?? dataUrl,
      directory: Directory.Cache,
    });
    return result.uri;
  }

  private async crearQrFile(codigo: string, dataUrl: string): Promise<File> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], `seclife-evento-familiar-${codigo}.png`, { type: 'image/png' });
  }

  private shareWasCanceled(error: unknown): boolean {
    const message = String((error as { message?: unknown })?.message ?? error ?? '').toLowerCase();
    return message.includes('cancel');
  }

  async escanear(): Promise<void> {
    try {
      const result = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
        scanOrientation: CapacitorBarcodeScannerScanOrientation.ADAPTIVE,
      });
      const value = result.ScanResult?.trim() || '';
      const token = value.match(/evento-familiar\/([0-9a-f-]{36})/i)?.[1];
      if (token) this.resolver(null, token); else if (/^\d{8}$/.test(value)) this.resolver(value, null);
      else this.present('El QR no corresponde a un evento familiar.', 'warning');
    } catch { this.present('No fue posible leer el codigo QR.', 'danger'); }
  }

  resolver(codigo = this.codigo.trim() || null, tokenUid: string | null = null): void {
    this.loading = true;
    this.eventosService.resolver(this.idorg, codigo, tokenUid).subscribe({
      next: evento => { this.eventoInvitado = evento; this.loading = false; },
      error: e => { this.loading = false; this.present(e.message, 'danger'); },
    });
  }

  actualizarSeleccionAlumno(alumno: EventoFamiliarAlumno, seleccionado: boolean): void {
    alumno.seleccionado = seleccionado;
    if (!seleccionado) alumno.autorizaSalida = false;
  }

  consultarRespuestas(evento: EventoFamiliarSocial): void {
    this.eventoRespuestas = evento;
    this.respuestas = [];
    this.loadingRespuestas = true;
    this.eventosService.consultarRespuestas(evento.ideventofamiliar, this.idorg).subscribe({
      next: respuestas => {
        this.respuestas = respuestas;
        this.loadingRespuestas = false;
        requestAnimationFrame(() => document.querySelector('.response-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      },
      error: e => {
        this.loadingRespuestas = false;
        this.eventoRespuestas = null;
        this.present(e.message, 'danger');
      },
    });
  }

  cerrarRespuestas(): void {
    this.eventoRespuestas = null;
    this.respuestas = [];
  }

  responder(confirmar: boolean): void {
    if (!this.eventoInvitado) return;
    if (confirmar && !(this.eventoInvitado.alumnos ?? []).some(a => a.seleccionado)) {
      return void this.present('Selecciona al menos un alumno.', 'warning');
    }
    this.saving = true;
    this.eventosService.responder(this.eventoInvitado, this.idorg, confirmar).subscribe({
      next: () => { this.saving = false; this.eventoInvitado = null; this.codigo = ''; this.present('Respuesta registrada.', 'success'); this.cargarEventos(); },
      error: e => { this.saving = false; this.present(e.message, 'danger'); },
    });
  }

  private createForm(): GuardarEventoFamiliarSocialRequest {
    const date = new Date(); date.setDate(date.getDate() + 1);
    return {
      idorg: this.idorg, idfamilia: 0, idfamiliamiembroAnfitrion: 0,
      nombre: '', descripcion: '', fechaEvento: date.toISOString().slice(0, 10),
      horaEvento: '17:00', horaSalidaColegio: '14:00', ubicacionGeneral: '', domicilio: '',
      telefonoContacto: '', maxAlumnosInvitados: 10, fechaLimiteConfirmacion: null,
      requiereAutorizacionSalida: true,
    };
  }

  private async present(message: string, color: string): Promise<void> {
    const toast = await this.toast.create({ message, color, duration: 3000, position: 'bottom' });
    await toast.present();
  }
}
