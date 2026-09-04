import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { AlertController, ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  AlumnoExpediente,
  CalidadRepresentacion,
  DetalleAsignacion,
  DocumentoFirmante,
  ExpedienteContexto,
  FamiliarExpediente,
  OtpRegistration,
  RepresentacionFamiliar,
} from '../../models/expediente-documental.model';
import { ExpedienteDocumentalService } from '../../services/expediente-documental.service';

type ExpedienteTab = 'representacion' | 'pendientes' | 'firmados';

@Component({
  selector: 'app-expediente-documental',
  templateUrl: './expediente-documental.page.html',
  styleUrls: ['./expediente-documental.page.scss'],
  standalone: false,
})
export class ExpedienteDocumentalPage implements OnInit {
  @ViewChild('signatureCanvas') signatureCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('supportPicker') supportPicker?: ElementRef<HTMLInputElement>;

  activeTab: ExpedienteTab = 'representacion';
  loading = false;
  savingRepresentation = false;
  uploadingSupport = false;
  loadingDetail = false;
  savingSignature = false;
  confirmingOtp = false;
  openingFile = false;
  context: ExpedienteContexto = { familias: [], alumnos: [], familiares: [], calidades: [] };
  representations: RepresentacionFamiliar[] = [];
  documents: DocumentoFirmante[] = [];

  representationModalOpen = false;
  documentModalOpen = false;
  selectedDocument: DocumentoFirmante | null = null;
  detail: DetalleAsignacion | null = null;
  supportTarget: RepresentacionFamiliar | null = null;
  supportFile: File | null = null;
  supportType = 'RESOLUCION_JUDICIAL';
  hasLegalSupport = false;
  representationForm = this.emptyRepresentationForm();

  drawing = false;
  hasSignature = false;
  legalAccepted = false;
  otp: OtpRegistration | null = null;
  otpCode = '';
  readonly mostrarOtpPrueba = !environment.production;

  constructor(
    private readonly service: ExpedienteDocumentalService,
    private readonly toastController: ToastController,
    private readonly alertController: AlertController
  ) {}

  ngOnInit(): void { this.load(); }

  get pendingDocuments(): DocumentoFirmante[] {
    return this.documents.filter(item => item.estatusFirmante === 'PENDIENTE'
      && ['PENDIENTE', 'ABIERTA'].includes(item.estatus));
  }

  get signedDocuments(): DocumentoFirmante[] {
    return this.documents.filter(item => ['FIRMADO', 'NO_REQUERIDA_POR_CUMPLIMIENTO'].includes(item.estatusFirmante));
  }

  get selectedStudent(): AlumnoExpediente | undefined {
    return this.context.alumnos.find(item => item.idmatricula === this.representationForm.idmatricula);
  }

  get familyMembers(): FamiliarExpediente[] {
    const idfamilia = this.selectedStudent?.idfamilia;
    return this.context.familiares.filter(item => item.idfamilia === idfamilia);
  }

  get selectedQuality(): CalidadRepresentacion | undefined {
    return this.context.calidades.find(item => item.clave === this.representationForm.claveCalidad);
  }

  async load(event?: { target?: { complete?: () => void } }): Promise<void> {
    this.loading = true;
    try {
      const [context, representations, documents] = await Promise.all([
        firstValueFrom(this.service.contexto()),
        firstValueFrom(this.service.representaciones()),
        firstValueFrom(this.service.documentos()),
      ]);
      this.context = context.result ?? this.context;
      this.representations = representations.result ?? [];
      this.documents = documents.result ?? [];
    } catch (error) {
      await this.toast(this.errorMessage(error, 'No fue posible consultar el expediente documental.'), 'danger');
    } finally {
      this.loading = false;
      event?.target?.complete?.();
    }
  }

  openRepresentation(): void {
    this.representationForm = this.emptyRepresentationForm();
    this.hasLegalSupport = false;
    this.supportFile = null;
    this.representationModalOpen = true;
  }

  onStudentChange(): void {
    this.representationForm.idfamiliamiembro = this.familyMembers[0]?.idfamiliamiembro ?? 0;
  }

  onSupportSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.supportFile = input.files?.[0] ?? null;
  }

  async saveRepresentation(): Promise<void> {
    if (!this.representationForm.idmatricula || !this.representationForm.idfamiliamiembro || !this.representationForm.claveCalidad) {
      await this.toast('Selecciona alumno, representante y calidad juridica.', 'warning');
      return;
    }
    if (this.hasLegalSupport && !this.supportFile) {
      await this.toast('Selecciona el PDF acreditativo.', 'warning');
      return;
    }
    this.savingRepresentation = true;
    try {
      const created = await firstValueFrom(this.service.proponer(this.representationForm));
      if (this.hasLegalSupport && this.supportFile) {
        await firstValueFrom(this.service.cargarSoporte(
          created.result.idrepresentacionlegal, this.supportFile, this.supportType));
      }
      this.representationModalOpen = false;
      await this.toast('Solicitud enviada al Colegio.', 'success');
      await this.load();
    } catch (error) {
      await this.toast(this.errorMessage(error, 'No fue posible registrar la representacion.'), 'danger');
    } finally {
      this.savingRepresentation = false;
    }
  }

  selectAdditionalSupport(item: RepresentacionFamiliar): void {
    this.supportTarget = item;
    this.supportPicker?.nativeElement.click();
  }

  async uploadAdditionalSupport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.supportTarget) return;
    this.uploadingSupport = true;
    try {
      await firstValueFrom(this.service.cargarSoporte(
        this.supportTarget.idrepresentacionlegal, file, 'RESOLUCION_JUDICIAL'));
      await this.toast('Soporte enviado al Colegio.', 'success');
      await this.load();
    } catch (error) {
      await this.toast(this.errorMessage(error, 'No fue posible adjuntar el soporte.'), 'danger');
    } finally {
      this.uploadingSupport = false;
      this.supportTarget = null;
      input.value = '';
    }
  }

  async reviewDocument(item: DocumentoFirmante): Promise<void> {
    this.selectedDocument = item;
    this.detail = null;
    this.otp = null;
    this.otpCode = '';
    this.legalAccepted = false;
    this.documentModalOpen = true;
    this.loadingDetail = true;
    try {
      const response = await firstValueFrom(this.service.detalle(item.idasignacion));
      this.detail = response.result;
    } catch (error) {
      this.documentModalOpen = false;
      await this.toast(this.errorMessage(error, 'No fue posible abrir la asignacion.'), 'danger');
    } finally {
      this.loadingDetail = false;
    }
  }

  initializeCanvas(): void {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#172033';
    context.lineWidth = 8;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    this.hasSignature = false;
  }

  startSignature(event: PointerEvent): void {
    const canvas = this.signatureCanvas?.nativeElement;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || this.otp) return;
    canvas.setPointerCapture(event.pointerId);
    const point = this.canvasPoint(event, canvas);
    context.beginPath();
    context.moveTo(point.x, point.y);
    this.drawing = true;
  }

  drawSignature(event: PointerEvent): void {
    const canvas = this.signatureCanvas?.nativeElement;
    const context = canvas?.getContext('2d');
    if (!this.drawing || !canvas || !context) return;
    const point = this.canvasPoint(event, canvas);
    context.lineTo(point.x, point.y);
    context.stroke();
    this.hasSignature = true;
  }

  stopSignature(): void { this.drawing = false; }
  clearSignature(): void { if (!this.otp) this.initializeCanvas(); }

  async submitSignature(): Promise<void> {
    if (!this.selectedDocument || !this.hasSignature || !this.legalAccepted) {
      await this.toast('Firma y confirma la declaracion para continuar.', 'warning');
      return;
    }
    this.savingSignature = true;
    try {
      const jpeg = await this.canvasBlob();
      const response = await firstValueFrom(this.service.registrarFirma(this.selectedDocument.idasignacion, jpeg));
      this.otp = response.result;
      const codigoPrueba = this.mostrarOtpPrueba ? this.otp.codigoPrueba ?? '' : '';
      this.otpCode = codigoPrueba;
      const otpMessage = codigoPrueba
        ? 'Codigo OTP de prueba generado.'
        : `Codigo enviado a ${this.otp.destino}.`;
      await this.toast(otpMessage, 'success');
    } catch (error) {
      await this.toast(this.errorMessage(error, 'No fue posible registrar la firma.'), 'danger');
    } finally {
      this.savingSignature = false;
    }
  }

  async confirmOtp(): Promise<void> {
    if (!this.selectedDocument || !this.otp || !/^\d{6}$/.test(this.otpCode)) {
      await this.toast('Captura el codigo de seis digitos.', 'warning');
      return;
    }
    this.confirmingOtp = true;
    try {
      await firstValueFrom(this.service.confirmarOtp(
        this.selectedDocument.idasignacion, this.otp.idotpdesafio, this.otp.nonce, this.otpCode));
      this.documentModalOpen = false;
      await this.toast('Firma confirmada correctamente.', 'success');
      await this.load();
      this.activeTab = 'firmados';
    } catch (error) {
      await this.toast(this.errorMessage(error, 'No fue posible confirmar el codigo.'), 'danger');
    } finally {
      this.confirmingOtp = false;
    }
  }

  async reject(item: DocumentoFirmante): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Rechazar documento',
      inputs: [{ name: 'motivo', type: 'textarea', placeholder: 'Motivo del rechazo' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Rechazar', role: 'destructive', handler: value => this.executeReject(item, value?.motivo) },
      ],
    });
    await alert.present();
  }

  async openDocument(item: DocumentoFirmante): Promise<void> {
    await this.openPdf(() => firstValueFrom(this.service.archivo(item.idasignacion)), `documento-${item.idasignacion}.pdf`);
  }

  async openEvidence(item: DocumentoFirmante): Promise<void> {
    await this.openPdf(() => firstValueFrom(this.service.evidencia(item.idasignacion)), `constancia-firma-${item.idasignacion}.pdf`);
  }

  studentName(idmatricula: number): string {
    return this.context.alumnos.find(item => item.idmatricula === idmatricula)?.nombre ?? `Alumno ${idmatricula}`;
  }

  statusColor(status: string): string {
    const value = status.toUpperCase();
    if (['VIGENTE', 'FIRMADO', 'FIRMADA'].includes(value)) return 'success';
    if (['RECHAZADO', 'BLOQUEADA_DISENSO'].includes(value)) return 'danger';
    if (value === 'NO_REQUERIDA_POR_CUMPLIMIENTO') return 'medium';
    return 'warning';
  }

  statusLabel(status: string): string {
    return status === 'NO_REQUERIDA_POR_CUMPLIMIENTO' ? 'CUMPLIDA POR OTRO FIRMANTE' : status.replaceAll('_', ' ');
  }

  formatDate(value?: string | null): string {
    if (!value) return 'Sin limite';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  }

  private async executeReject(item: DocumentoFirmante, reason?: string): Promise<boolean> {
    const value = (reason ?? '').trim();
    if (value.length < 5) {
      await this.toast('Indica un motivo de al menos cinco caracteres.', 'warning');
      return false;
    }
    try {
      await firstValueFrom(this.service.rechazar(item.idasignacion, value));
      await this.toast('Rechazo registrado.', 'success');
      await this.load();
      return true;
    } catch (error) {
      await this.toast(this.errorMessage(error, 'No fue posible registrar el rechazo.'), 'danger');
      return false;
    }
  }

  private async openPdf(loader: () => Promise<Blob>, fileName: string): Promise<void> {
    if (this.openingFile) return;
    this.openingFile = true;
    const target = !Capacitor.isNativePlatform() ? window.open('', '_blank') : null;
    try {
      const blob = await loader();
      if (Capacitor.isNativePlatform()) {
        const data = await this.blobToBase64(blob);
        const result = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache });
        await FileOpener.openFile({ path: result.uri, mimeType: 'application/pdf' });
      } else {
        const url = URL.createObjectURL(blob);
        if (target) target.location.href = url; else window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    } catch (error) {
      target?.close();
      await this.toast(this.errorMessage(error, 'No fue posible abrir el PDF.'), 'danger');
    } finally {
      this.openingFile = false;
    }
  }

  private canvasPoint(event: PointerEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  }

  private canvasBlob(): Promise<Blob> {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return Promise.reject(new Error('No existe el lienzo de firma.'));
    return new Promise((resolve, reject) => canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('No fue posible generar la firma JPEG.')),
      'image/jpeg', 0.9));
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? '').split(',').pop() ?? '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  private emptyRepresentationForm() {
    return { idmatricula: 0, idfamiliamiembro: 0, claveCalidad: '', fechaInicio: null, fechaFin: null, observaciones: '' };
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  private async toast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({ message, color, duration: 3200, position: 'bottom' });
    await toast.present();
  }
}
