import { Component, OnInit } from '@angular/core';
import QRCode from 'qrcode';
import { AuthService } from '../../../../core/auth/auth.service';
import {
  CredencialDigital,
  CredencialDigitalLayout,
  CredencialDigitalLayoutField,
  CredencialDigitalLayoutFieldKey,
} from '../../models/credencial-digital.model';
import { CredencialDigitalService } from '../../services/credencial-digital.service';

const FONT_FAMILY_OPTIONS = ['Arial', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia'];
const DEFAULT_LAYOUT_FIELDS: Required<Pick<CredencialDigitalLayoutField, 'key' | 'enabled' | 'x' | 'y' | 'width' | 'height' | 'fontSize' | 'fontFamily' | 'align' | 'color'>>[] = [
  { key: 'tipoPortador', enabled: true, x: 64, y: 6, width: 28, height: 5, fontSize: 11, fontFamily: 'Arial', align: 'center', color: '#172033' },
  { key: 'foto', enabled: true, x: 38, y: 22, width: 24, height: 18, fontSize: 12, fontFamily: 'Arial', align: 'center', color: '#172033' },
  { key: 'nombre', enabled: true, x: 12, y: 44, width: 76, height: 5, fontSize: 18, fontFamily: 'Arial', align: 'center', color: '#172033' },
  { key: 'apellidos', enabled: true, x: 12, y: 50, width: 76, height: 5, fontSize: 14, fontFamily: 'Arial', align: 'center', color: '#172033' },
  { key: 'familia', enabled: false, x: 12, y: 56, width: 76, height: 5, fontSize: 12, fontFamily: 'Arial', align: 'center', color: '#172033' },
  { key: 'cargo', enabled: false, x: 12, y: 56, width: 76, height: 5, fontSize: 12, fontFamily: 'Arial', align: 'center', color: '#172033' },
  { key: 'cicloEscolar', enabled: true, x: 12, y: 63, width: 76, height: 4, fontSize: 11, fontFamily: 'Arial', align: 'center', color: '#172033' },
  { key: 'unidadAdministrativa', enabled: true, x: 12, y: 68, width: 76, height: 4, fontSize: 11, fontFamily: 'Arial', align: 'center', color: '#172033' },
  { key: 'fechaNacimiento', enabled: false, x: 10, y: 74, width: 42, height: 4, fontSize: 10, fontFamily: 'Arial', align: 'left', color: '#172033' },
  { key: 'tipoSangre', enabled: false, x: 54, y: 74, width: 36, height: 4, fontSize: 10, fontFamily: 'Arial', align: 'right', color: '#172033' },
  { key: 'alergias', enabled: false, x: 10, y: 79, width: 80, height: 4, fontSize: 10, fontFamily: 'Arial', align: 'left', color: '#172033' },
  { key: 'qr', enabled: true, x: 37, y: 82, width: 26, height: 12, fontSize: 12, fontFamily: 'Arial', align: 'center', color: '#172033' },
  { key: 'textoPie', enabled: true, x: 10, y: 95, width: 80, height: 4, fontSize: 10, fontFamily: 'Arial', align: 'center', color: '#172033' },
];

@Component({
  selector: 'app-credencial-digital',
  templateUrl: './credencial-digital.page.html',
  styleUrls: ['./credencial-digital.page.scss'],
  standalone: false,
})
export class CredencialDigitalPage implements OnInit {
  loading = false;
  errorMessage: string | null = null;
  credencial: CredencialDigital | null = null;
  qrImageSrc: string | null = null;
  layout: CredencialDigitalLayout = this.defaultLayout();

  constructor(
    private readonly credencialDigitalService: CredencialDigitalService,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  get nombreCompleto(): string {
    return [this.credencial?.nombre, this.credencial?.apellidos].filter(Boolean).join(' ').trim() || 'Credencial Digital';
  }

  get tipoPortadorLabel(): string {
    const tipo = (this.credencial?.tipoPortador ?? '').toUpperCase();
    if (tipo === 'ALUMNO') {
      return 'Alumno';
    }
    if (tipo === 'FAMILIAR') {
      return 'Familiar';
    }
    if (tipo === 'PERSONAL') {
      return 'Personal';
    }
    return 'Credencial';
  }

  get fotoSrc(): string | null {
    const foto = this.normalizeImageSource(this.credencial?.foto);
    if (!foto) {
      return null;
    }

    return /^data:image\//i.test(foto) || /^https?:\/\//i.test(foto)
      ? foto
      : `data:${this.detectImageContentType(foto)};base64,${foto}`;
  }

  get fondoStyle(): string | null {
    const fondoUrl = this.credencial?.plantilla?.fondoUrl?.trim();
    return fondoUrl ? `url("${fondoUrl}")` : null;
  }

  get fondoOpacity(): number {
    return this.clamp(Number(this.layout.fondoOpacity ?? 100), 0, 100) / 100;
  }

  get primaryColor(): string {
    return this.credencial?.plantilla?.colorPrimario || '#145ee8';
  }

  get secondaryColor(): string {
    return this.credencial?.plantilla?.colorSecundario || '#f8fafc';
  }

  cargar(event?: { target?: { complete?: () => void } }): void {
    const user = this.authService.getCurrentUser();
    if (!user?.idorg) {
      this.errorMessage = 'No se encontro organizacion en la sesion.';
      event?.target?.complete?.();
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    this.credencialDigitalService.consultarVigente({
      idorg: user.idorg,
    }).subscribe({
      next: async (credencial) => {
        this.credencial = credencial;
        this.layout = this.resolveLayout(credencial.plantilla?.layoutJson);
        this.qrImageSrc = await this.generateQr(credencial.qrPayload || credencial.codigo || '');
        console.log('[CredencialDigitalPage] credencial result', credencial);
        console.log('[CredencialDigitalPage] foto raw', this.imageDebugInfo(credencial.foto));
        console.log('[CredencialDigitalPage] foto src', this.imageDebugInfo(this.fotoSrc));
        console.log('[CredencialDigitalPage] familia', credencial.familia);
        console.log('[CredencialDigitalPage] layoutJson raw', credencial.plantilla?.layoutJson);
        console.log('[CredencialDigitalPage] layout resolved', this.layout);
        console.log('[CredencialDigitalPage] visible fields', this.visibleLayoutFields().map((field) => field.key));
        this.loading = false;
        event?.target?.complete?.();
      },
      error: (error) => {
        this.credencial = null;
        this.qrImageSrc = null;
        this.layout = this.defaultLayout();
        this.errorMessage = this.resolveErrorMessage(error);
        this.loading = false;
        event?.target?.complete?.();
      },
    });
  }

  visibleLayoutFields(): CredencialDigitalLayoutField[] {
    return (this.layout.fields ?? []).filter((field) => field.enabled !== false);
  }

  fieldStyle(field: CredencialDigitalLayoutField): Record<string, string> {
    return {
      left: `${this.clamp(Number(field.x ?? 0), 0, 100)}%`,
      top: `${this.clamp(Number(field.y ?? 0), 0, 100)}%`,
      width: `${this.clamp(Number(field.width ?? 1), 1, 100)}%`,
      height: `${this.clamp(Number(field.height ?? 1), 1, 100)}%`,
      fontSize: `${this.clamp(Number(field.fontSize ?? 12), 8, 28)}px`,
      fontFamily: this.normalizeFontFamily(field.fontFamily),
      textAlign: this.normalizeAlign(field.align),
      color: this.normalizeColor(field.color),
    };
  }

  fieldText(field: CredencialDigitalLayoutField): string {
    const key = this.normalizeFieldKey(field.key);
    const values: Record<CredencialDigitalLayoutFieldKey, string> = {
      tipoPortador: this.tipoPortadorLabel,
      nombre: this.credencial?.nombre?.trim() || this.nombreCompleto,
      apellidos: this.credencial?.apellidos?.trim() || '',
      familia: this.credencial?.familia?.trim() || '',
      cicloEscolar: this.credencial?.cicloEscolar?.trim() || String(this.credencial?.idciclo ?? ''),
      unidadAdministrativa: this.credencial?.unidadAdministrativa?.trim() || '',
      fechaNacimiento: this.formatDate(this.credencial?.fechaNacimiento),
      tipoSangre: this.credencial?.tipoSangre?.trim() || '',
      alergias: this.credencial?.alergias?.trim() || '',
      cargo: this.credencial?.puesto?.trim() || '',
      foto: '',
      qr: '',
      textoPie: this.credencial?.plantilla?.textoPie?.trim() || '',
    };

    return values[key] ?? '';
  }

  isImageField(field: CredencialDigitalLayoutField): boolean {
    return this.normalizeFieldKey(field.key) === 'foto';
  }

  isQrField(field: CredencialDigitalLayoutField): boolean {
    return this.normalizeFieldKey(field.key) === 'qr';
  }

  onPhotoLoaded(): void {
    console.log('[CredencialDigitalPage] foto loaded');
  }

  onPhotoError(event: Event): void {
    console.warn('[CredencialDigitalPage] foto load error', {
      foto: this.imageDebugInfo(this.credencial?.foto),
      src: this.imageDebugInfo(this.fotoSrc),
      event,
    });
  }

  private async generateQr(value: string): Promise<string | null> {
    if (!value.trim()) {
      return null;
    }

    return QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 4,
      scale: 8,
    });
  }

  private resolveLayout(value: unknown): CredencialDigitalLayout {
    const parsed = this.parseMaybeNestedJson(value);
    if (!parsed || typeof parsed !== 'object') {
      return this.defaultLayout();
    }

    const candidate = parsed as CredencialDigitalLayout;
    const incomingFields = Array.isArray(candidate.fields) ? candidate.fields : [];
    const fields = DEFAULT_LAYOUT_FIELDS.map((defaultField) => {
      const incoming = incomingFields.find((field) => this.normalizeFieldKey(field?.key) === defaultField.key);
      return {
        ...defaultField,
        ...incoming,
        key: defaultField.key,
        enabled: typeof incoming?.enabled === 'boolean' ? incoming.enabled : defaultField.enabled,
        x: this.clamp(Number(incoming?.x ?? defaultField.x), 0, 100),
        y: this.clamp(Number(incoming?.y ?? defaultField.y), 0, 100),
        width: this.clamp(Number(incoming?.width ?? defaultField.width), 1, 100),
        height: this.clamp(Number(incoming?.height ?? defaultField.height), 1, 100),
        fontSize: this.clamp(Number(incoming?.fontSize ?? defaultField.fontSize), 8, 28),
        fontFamily: this.normalizeFontFamily(incoming?.fontFamily ?? defaultField.fontFamily),
        align: this.normalizeAlign(incoming?.align ?? defaultField.align),
        color: this.normalizeColor(incoming?.color ?? defaultField.color),
      };
    });

    return {
      version: 1,
      fondoOpacity: this.clamp(Number(candidate.fondoOpacity ?? 100), 0, 100),
      fields,
    };
  }

  private defaultLayout(): CredencialDigitalLayout {
    return {
      version: 1,
      fondoOpacity: 100,
      fields: DEFAULT_LAYOUT_FIELDS.map((field) => ({ ...field })),
    };
  }

  private parseMaybeNestedJson(value: unknown): unknown {
    let parsed = value;
    for (let i = 0; i < 2 && typeof parsed === 'string'; i += 1) {
      parsed = this.safeJsonParse(parsed);
    }

    return parsed;
  }

  private safeJsonParse(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private normalizeAlign(value: unknown): 'left' | 'center' | 'right' {
    return value === 'left' || value === 'center' || value === 'right' ? value : 'center';
  }

  private normalizeColor(value: unknown): string {
    const color = String(value ?? '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#172033';
  }

  private normalizeFontFamily(value: unknown): string {
    const font = String(value ?? '').trim();
    return FONT_FAMILY_OPTIONS.includes(font) ? font : 'Arial';
  }

  private normalizeFieldKey(value: unknown): CredencialDigitalLayoutFieldKey {
    const key = String(value ?? '').trim();
    const normalizedKey = key.toLowerCase();
    const aliases: Record<string, CredencialDigitalLayoutFieldKey> = {
      tipoportador: 'tipoPortador',
      nombre: 'nombre',
      apellidos: 'apellidos',
      familia: 'familia',
      cicloescolar: 'cicloEscolar',
      unidadescolar: 'unidadAdministrativa',
      unidadadministrativa: 'unidadAdministrativa',
      fechanacimiento: 'fechaNacimiento',
      tiposangre: 'tipoSangre',
      alergias: 'alergias',
      cargo: 'cargo',
      foto: 'foto',
      qr: 'qr',
      codigoqr: 'qr',
      textopie: 'textoPie',
      puesto: 'cargo',
      cargopuesto: 'cargo',
      leyenda: 'textoPie',
      leyendainstitucional: 'textoPie',
      fechanac: 'fechaNacimiento',
      fecnac: 'fechaNacimiento',
      sangre: 'tipoSangre',
      tipo_sangre: 'tipoSangre',
      alergia: 'alergias'
    };

    return aliases[normalizedKey] ?? (key as CredencialDigitalLayoutFieldKey);
  }

  private normalizeImageSource(value: string | null | undefined): string {
    const source = String(value ?? '').trim();
    if (!source) {
      return '';
    }

    if (/^data:image\//i.test(source) || /^https?:\/\//i.test(source)) {
      return source.replace(/\s+/g, '');
    }

    if (/^0x[0-9a-f]+$/i.test(source)) {
      return '';
    }

    return source.replace(/\s+/g, '');
  }

  private detectImageContentType(base64: string): string {
    const prefix = base64.slice(0, 16);
    if (prefix.startsWith('/9j/')) {
      return 'image/jpeg';
    }
    if (prefix.startsWith('iVBORw0KGgo')) {
      return 'image/png';
    }
    if (prefix.startsWith('R0lGOD')) {
      return 'image/gif';
    }
    if (prefix.startsWith('UklGR')) {
      return 'image/webp';
    }

    return 'image/jpeg';
  }

  private imageDebugInfo(value: string | null | undefined): { hasValue: boolean; length: number; prefix: string } {
    const normalized = this.normalizeImageSource(value);
    return {
      hasValue: normalized.length > 0,
      length: normalized.length,
      prefix: normalized.slice(0, 48),
    };
  }

  private formatDate(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const raw = value.trim();
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
    if (dateOnly) {
      return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-MX');
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }

    return Math.min(max, Math.max(min, value));
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'object' && error && 'error' in error) {
      const body = (error as { error?: { message?: string } }).error;
      if (body?.message) {
        return body.message;
      }
    }

    return 'No fue posible consultar la credencial digital.';
  }
}
