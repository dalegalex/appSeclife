import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { ToastController } from '@ionic/angular';
import QRCode from 'qrcode';
import {
  PuntoRegistroVisitante,
  RegistrarVisitanteProveedorRequest,
  VisitanteProveedorPase,
} from '../../models/visitantes-proveedores.model';
import { VisitantesProveedoresService } from '../../services/visitantes-proveedores.service';

@Component({
  selector: 'app-registro-visitante-proveedor',
  templateUrl: './registro-visitante-proveedor.page.html',
  styleUrls: ['./registro-visitante-proveedor.page.scss'],
  standalone: false,
})
export class RegistroVisitanteProveedorPage implements OnInit {
  loading = true;
  saving = false;
  codigoPunto = '';
  punto: PuntoRegistroVisitante | null = null;
  pase: VisitanteProveedorPase | null = null;
  qrDataUrl = '';

  form: RegistrarVisitanteProveedorRequest = {
    tipoVisitante: 'VISITANTE',
    nombre: '',
    apellidos: '',
    empresa: '',
    cel: '',
    emailContacto: '',
    areaVisita: '',
    personaVisita: '',
    motivoVisita: '',
    foto: null,
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly visitantesService: VisitantesProveedoresService,
    private readonly toastController: ToastController
  ) {}

  ngOnInit(): void {
    this.codigoPunto = this.route.snapshot.paramMap.get('codigo') ?? '';
    this.cargarPunto();
  }

  setTipoVisitante(tipoVisitante: 'VISITANTE' | 'PROVEEDOR'): void {
    this.form.tipoVisitante = tipoVisitante;

    if (tipoVisitante === 'VISITANTE') {
      this.form.empresa = '';
      return;
    }

    this.form.cel = '';
    this.form.emailContacto = '';
    this.form.motivoVisita = '';
  }

  cargarPunto(): void {
    if (!this.codigoPunto) {
      this.loading = false;
      void this.showToast('Codigo de punto no valido.', 'danger');
      return;
    }

    this.loading = true;
    this.visitantesService.consultarPunto(this.codigoPunto).subscribe({
      next: (punto) => {
        this.punto = punto;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        void this.showToast(this.errorMessage(error, 'No fue posible consultar el punto de registro.'), 'danger');
      },
    });
  }

  registrar(): void {
    if (!this.punto) {
      return;
    }

    const request = this.normalizeRequest();
    if (!request.nombre) {
      void this.showToast('Captura el nombre.', 'warning');
      return;
    }

    if (request.tipoVisitante === 'VISITANTE' && !request.motivoVisita) {
      void this.showToast('Captura el motivo de visita.', 'warning');
      return;
    }

    if (request.tipoVisitante === 'PROVEEDOR' && !request.empresa) {
      void this.showToast('Captura la empresa del proveedor.', 'warning');
      return;
    }

    this.saving = true;
    this.visitantesService.registrarPreregistro(this.punto.idpuntoregistrovisitante, request).subscribe({
      next: async (pase) => {
        this.pase = pase;
        this.qrDataUrl = await this.generarQrDataUrl(pase.codigoPase);
        this.saving = false;
        void this.showToast('Pase generado correctamente.', 'success');
      },
      error: (error) => {
        this.saving = false;
        void this.showToast(this.errorMessage(error, 'No fue posible generar el pase.'), 'danger');
      },
    });
  }

  nuevoRegistro(): void {
    this.pase = null;
    this.qrDataUrl = '';
    this.form = {
      tipoVisitante: 'VISITANTE',
      nombre: '',
      apellidos: '',
      empresa: '',
      cel: '',
      emailContacto: '',
      areaVisita: '',
      personaVisita: '',
      motivoVisita: '',
      foto: null,
    };
  }

  async compartirPase(): Promise<void> {
    if (!this.pase) {
      return;
    }

    const text = [
      `Pase Seclife: ${this.pase.codigoPase}`,
      `Visitante: ${this.pase.visitante ?? ''}`,
      this.mapsUrl ? `Ubicacion: ${this.mapsUrl}` : '',
    ].filter(Boolean).join('\n');

    if (Capacitor.isNativePlatform()) {
      await Share.share({
        title: 'Pase Seclife',
        text,
        dialogTitle: 'Compartir pase Seclife',
      });
      return;
    }

    if (navigator.share) {
      await navigator.share({ title: 'Pase Seclife', text });
      return;
    }

    await navigator.clipboard?.writeText(text);
    await this.showToast('Datos del pase copiados.', 'success');
  }

  onUpperInput(field: keyof RegistrarVisitanteProveedorRequest): void {
    const value = this.form[field];
    if (typeof value === 'string') {
      (this.form as unknown as Record<string, unknown>)[field] = value.toUpperCase();
    }
  }

  async onFotoSeleccionada(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      this.form.foto = await this.fileToCompressedBase64(file);
    } catch {
      await this.showToast('No fue posible cargar la fotografia.', 'danger');
    } finally {
      input.value = '';
    }
  }

  get logoSrc(): string | null {
    const logo = this.punto?.logoorg?.trim();
    if (!logo) {
      return null;
    }

    return logo.startsWith('data:image') ? logo : `data:image/png;base64,${logo}`;
  }

  get mapsUrl(): string | null {
    const latitud = this.punto?.latitud;
    const longitud = this.punto?.longitud;
    if (latitud == null || longitud == null) {
      return null;
    }

    return `https://www.google.com/maps?q=${latitud},${longitud}`;
  }

  private normalizeRequest(): RegistrarVisitanteProveedorRequest {
    return {
      idorg: this.punto?.idorg,
      tipoVisitante: this.form.tipoVisitante,
      nombre: (this.form.nombre ?? '').trim().toUpperCase(),
      apellidos: null,
      empresa: this.form.tipoVisitante === 'PROVEEDOR' ? (this.form.empresa ?? '').trim().toUpperCase() : null,
      cel: this.form.tipoVisitante === 'VISITANTE' ? (this.form.cel ?? '').trim() : null,
      emailContacto: this.form.tipoVisitante === 'VISITANTE' ? (this.form.emailContacto ?? '').trim() : null,
      areaVisita: (this.form.areaVisita ?? '').trim().toUpperCase(),
      personaVisita: null,
      motivoVisita: this.form.tipoVisitante === 'VISITANTE' ? (this.form.motivoVisita ?? '').trim() : null,
      foto: this.form.foto ?? null,
    };
  }

  private generarQrDataUrl(codigo: string): Promise<string> {
    return QRCode.toDataURL(codigo, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 420,
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    });
  }

  private fileToCompressedBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSide = 720;
          const ratio = Math.min(maxSide / image.width, maxSide / image.height, 1);
          canvas.width = Math.round(image.width * ratio);
          canvas.height = Math.round(image.height * ratio);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas no disponible.'));
            return;
          }

          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.72).split(',')[1]);
        };
        image.onerror = () => reject(new Error('Imagen no valida.'));
        image.src = String(reader.result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private errorMessage(error: unknown, fallback: string): string {
    return String((error as { error?: { message?: string }; message?: string })?.error?.message
      ?? (error as { message?: string })?.message
      ?? fallback);
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2800,
      color,
      position: 'top',
    });
    await toast.present();
  }
}
