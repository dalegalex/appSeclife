import { ChangeDetectorRef, Component, ElementRef, Inject, OnInit, Optional, ViewChild, ViewRef } from '@angular/core';
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
  DatosContractualesAsignacion,
  DocumentoFirmante,
  ExpedienteContexto,
  FamiliarExpediente,
  OtpRegistration,
  ProponerRepresentacionRequest,
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
  private signatureCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('signatureCanvas')
  set signatureCanvas(value: ElementRef<HTMLCanvasElement> | undefined) {
    if (this.signatureCanvasRef?.nativeElement === value?.nativeElement) return;
    this.signatureCanvasRef = value;
    this.drawing = false;
    this.hasSignature = false;
    if (value) this.initializeCanvas();
  }
  get signatureCanvas(): ElementRef<HTMLCanvasElement> | undefined {
    return this.signatureCanvasRef;
  }
  @ViewChild('supportPicker') supportPicker?: ElementRef<HTMLInputElement>;

  activeTab: ExpedienteTab = 'representacion';
  loading = false;
  savingRepresentation = false;
  savingContractIdentity = false;
  confirmingContractData = false;
  restoringRepresentationId: number | null = null;
  uploadingSupport = false;
  loadingDetail = false;
  savingSignature = false;
  confirmingOtp = false;
  openingFile = false;
  context: ExpedienteContexto = { familias: [], alumnos: [], familiares: [], calidades: [] };
  representations: RepresentacionFamiliar[] = [];
  documents: DocumentoFirmante[] = [];

  representationModalOpen = false;
  contractIdentityModalOpen = false;
  documentModalOpen = false;
  selectedDocument: DocumentoFirmante | null = null;
  detail: DetalleAsignacion | null = null;
  contractData: DatosContractualesAsignacion | null = null;
  contractDataForm: ProponerRepresentacionRequest = this.emptyRepresentationForm();
  supportTarget: RepresentacionFamiliar | null = null;
  supportFile: File | null = null;
  supportType = 'RESOLUCION_JUDICIAL';
  hasLegalSupport = false;
  representationForm: ProponerRepresentacionRequest = this.emptyRepresentationForm();
  contractIdentityTarget: RepresentacionFamiliar | null = null;
  contractIdentityForm: ProponerRepresentacionRequest = this.emptyRepresentationForm();

  drawing = false;
  hasSignature = false;
  legalAccepted = false;
  otp: OtpRegistration | null = null;
  otpCode = '';
  readonly mostrarOtpPrueba = !environment.production;

  constructor(
    private readonly service: ExpedienteDocumentalService,
    private readonly toastController: ToastController,
    private readonly alertController: AlertController,
    @Optional() @Inject(ChangeDetectorRef) private readonly changeDetector: ChangeDetectorRef | null = null
  ) {}

  ngOnInit(): void { this.load(); }

  changeTab(value: unknown): void {
    if (value !== 'representacion' && value !== 'pendientes' && value !== 'firmados') return;
    this.activeTab = value;
    if (this.changeDetector && !(this.changeDetector as ViewRef).destroyed) this.changeDetector.detectChanges();
  }

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
    const idmatricula = this.selectedStudent?.idmatricula;
    return this.context.familiares.filter(item => item.idfamilia === idfamilia && item.idmatricula === idmatricula);
  }

  get selectedQuality(): CalidadRepresentacion | undefined {
    return this.context.calidades.find(item => item.clave === this.representationForm.claveCalidad);
  }

  get selectedRepresentative(): FamiliarExpediente | undefined {
    return this.familyMembers.find(item => item.idfamiliamiembro === this.representationForm.idfamiliamiembro);
  }

  get availableQualities(): CalidadRepresentacion[] {
    const relationship = this.selectedRepresentative?.parentesco?.toUpperCase();
    const forcedQuality = this.qualityForRelationship(relationship);
    if (forcedQuality) {
      return this.context.calidades.filter(item => item.clave === forcedQuality);
    }
    return this.context.calidades.filter(item => !['PADRE', 'MADRE'].includes(item.clave));
  }

  get qualityLocked(): boolean {
    return !!this.qualityForRelationship(this.selectedRepresentative?.parentesco?.toUpperCase());
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
      if (this.changeDetector && !(this.changeDetector as ViewRef).destroyed) this.changeDetector.detectChanges();
      event?.target?.complete?.();
    }
  }

  openRepresentation(): void {
    this.representationForm = this.emptyRepresentationForm();
    this.hasLegalSupport = false;
    this.supportFile = null;
    this.representationModalOpen = true;
  }

  openContractIdentity(item: RepresentacionFamiliar): void {
    const identity = this.context.familiares.find(member => member.idusrbtFirmante === item.idusrbtFirmante);
    this.contractIdentityTarget = item;
    this.contractIdentityForm = {
      ...this.emptyRepresentationForm(),
      ocupacion: identity?.ocupacion ?? item.ocupacion ?? '',
      nacionalidad: identity?.nacionalidad ?? item.nacionalidad ?? '',
      rfc: identity?.rfc ?? item.rfc ?? '',
      direccionCalle: identity?.direccionCalle ?? '',
      direccionNumeroExterior: identity?.direccionNumeroExterior ?? '',
      direccionNumeroInterior: identity?.direccionNumeroInterior ?? '',
      direccionColonia: identity?.direccionColonia ?? '',
      direccionMunicipio: identity?.direccionMunicipio ?? '',
      direccionEstado: identity?.direccionEstado ?? '',
      direccionCp: identity?.direccionCp ?? '',
      direccionReferencia: identity?.direccionReferencia ?? '',
      telefonos: identity?.telefonos ?? '',
    };
    this.contractIdentityModalOpen = true;
  }

  updateContractIdentityField(field:
    'ocupacion' | 'nacionalidad' | 'rfc' | 'direccionCalle' | 'direccionNumeroExterior' |
    'direccionNumeroInterior' | 'direccionColonia' | 'direccionMunicipio' | 'direccionEstado' |
    'direccionCp' | 'direccionReferencia' | 'telefonos', event: CustomEvent): void {
    this.contractIdentityForm[field] = String(event.detail?.value ?? '').toUpperCase();
  }

  async saveContractIdentity(): Promise<void> {
    if (!this.contractIdentityTarget) return;
    const required: Array<keyof ProponerRepresentacionRequest> = [
      'ocupacion', 'nacionalidad', 'direccionCalle', 'direccionNumeroExterior',
      'direccionColonia', 'direccionMunicipio', 'direccionEstado', 'direccionCp', 'telefonos'
    ];
    if (required.some(field => !String(this.contractIdentityForm[field] ?? '').trim())) {
      await this.toast('Completa ocupación, nacionalidad, domicilio y teléfonos.', 'warning');
      return;
    }
    const rfc = this.normalizeRfc(this.contractIdentityForm.rfc);
    if (rfc && !/^[A-Z&Ñ]{4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc)) {
      await this.toast('El RFC debe contener 13 caracteres con formato de persona física.', 'warning');
      return;
    }
    this.contractIdentityForm.rfc = rfc;
    this.contractIdentityForm.ocupacion = this.normalizeText(this.contractIdentityForm.ocupacion);
    this.contractIdentityForm.nacionalidad = this.normalizeText(this.contractIdentityForm.nacionalidad);
    this.savingContractIdentity = true;
    try {
      const response = await firstValueFrom(this.service.actualizarDatosContractuales(
        this.contractIdentityTarget.idrepresentacionlegal, this.contractIdentityForm));
      this.contractIdentityModalOpen = false;
      await this.toast(response.message || 'Datos contractuales actualizados correctamente.', 'success');
      await this.load();
    } catch (error) {
      await this.toast(this.errorMessage(error, 'No fue posible actualizar los datos contractuales.'), 'danger');
    } finally {
      this.savingContractIdentity = false;
    }
  }

  onStudentChange(): void {
    this.representationForm.idfamiliamiembro = this.familyMembers[0]?.idfamiliamiembro ?? 0;
    this.onRepresentativeChange();
  }

  onRepresentativeChange(): void {
    this.representationForm.claveCalidad = this.qualityForRelationship(
      this.selectedRepresentative?.parentesco?.toUpperCase()) ?? '';
    this.representationForm.ocupacion = this.selectedRepresentative?.ocupacion ?? '';
    this.representationForm.nacionalidad = this.selectedRepresentative?.nacionalidad ?? '';
    this.representationForm.rfc = this.selectedRepresentative?.rfc ?? '';
    this.representationForm.direccionCalle = this.selectedRepresentative?.direccionCalle ?? '';
    this.representationForm.direccionNumeroExterior = this.selectedRepresentative?.direccionNumeroExterior ?? '';
    this.representationForm.direccionNumeroInterior = this.selectedRepresentative?.direccionNumeroInterior ?? '';
    this.representationForm.direccionColonia = this.selectedRepresentative?.direccionColonia ?? '';
    this.representationForm.direccionMunicipio = this.selectedRepresentative?.direccionMunicipio ?? '';
    this.representationForm.direccionEstado = this.selectedRepresentative?.direccionEstado ?? '';
    this.representationForm.direccionCp = this.selectedRepresentative?.direccionCp ?? '';
    this.representationForm.direccionReferencia = this.selectedRepresentative?.direccionReferencia ?? '';
    this.representationForm.telefonos = this.selectedRepresentative?.telefonos ?? '';
    this.hasLegalSupport = false;
    this.supportFile = null;
    this.onQualityChange();
  }

  onSupportSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.supportFile = input.files?.[0] ?? null;
  }

  onQualityChange(): void {
    if (this.selectedQuality?.requiereSoporte) {
      this.hasLegalSupport = true;
    }
  }

  async saveRepresentation(): Promise<void> {
    if (!this.representationForm.idmatricula || !this.representationForm.idfamiliamiembro || !this.representationForm.claveCalidad) {
      await this.toast('Selecciona alumno, representante y calidad juridica.', 'warning');
      return;
    }
    const rfc = this.normalizeRfc(this.representationForm.rfc);
    if (rfc && !/^[A-Z&Ñ]{4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc)) {
      await this.toast('El RFC del representante debe contener 13 caracteres con formato de persona física.', 'warning');
      return;
    }
    this.representationForm.ocupacion = this.normalizeText(this.representationForm.ocupacion);
    this.representationForm.nacionalidad = this.normalizeText(this.representationForm.nacionalidad);
    this.representationForm.rfc = rfc || null;
    const supportRequired = this.selectedQuality?.requiereSoporte === true;
    if ((supportRequired || this.hasLegalSupport) && !this.supportFile) {
      await this.toast(
        supportRequired
          ? 'La calidad juridica seleccionada requiere un documento PDF acreditativo.'
          : 'Selecciona el PDF acreditativo.',
        'warning');
      return;
    }
    this.savingRepresentation = true;
    try {
      const includesSupport = (supportRequired || this.hasLegalSupport) && !!this.supportFile;
      if (includesSupport) {
        await firstValueFrom(this.service.proponerConSoporte(
          this.representationForm, this.supportFile!, this.supportType));
      } else {
        await firstValueFrom(this.service.proponer(this.representationForm));
      }
      this.representationModalOpen = false;
      await this.toast(
        includesSupport
          ? 'Representacion y soporte enviados al Colegio.'
          : 'Representacion autorizada correctamente.',
        'success');
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

  async confirmRestoreRepresentation(item: RepresentacionFamiliar): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Restaurar representación',
      message: 'Solo continuará si la relación activa entre el familiar y el alumno ya existe nuevamente en Red Familiar. Si hay soporte jurídico, el Colegio deberá revisarla otra vez. Las asignaciones y firmas anteriores no se reactivarán.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Restaurar', handler: () => void this.restoreRepresentation(item) },
      ],
    });
    await alert.present();
  }

  async reviewDocument(item: DocumentoFirmante): Promise<void> {
    this.drawing = false;
    this.hasSignature = false;
    this.selectedDocument = item;
    this.detail = null;
    this.contractData = null;
    this.otp = null;
    this.otpCode = '';
    this.legalAccepted = false;
    this.documentModalOpen = true;
    this.loadingDetail = true;
    try {
      const [detailResponse, contractResponse] = await Promise.all([
        firstValueFrom(this.service.detalle(item.idasignacion)),
        firstValueFrom(this.service.datosContractuales(item.idasignacion)),
      ]);
      this.detail = detailResponse.result;
      this.setContractData(contractResponse.result);
    } catch (error) {
      this.documentModalOpen = false;
      await this.toast(this.errorMessage(error, 'No fue posible abrir la asignacion.'), 'danger');
    } finally {
      this.loadingDetail = false;
    }
  }

  updateAssignmentContractField(field:
    'ocupacion' | 'nacionalidad' | 'rfc' | 'direccionCalle' | 'direccionNumeroExterior' |
    'direccionNumeroInterior' | 'direccionColonia' | 'direccionMunicipio' | 'direccionEstado' |
    'direccionCp' | 'direccionReferencia' | 'telefonos', event: CustomEvent): void {
    this.contractDataForm[field] = String(event.detail?.value ?? '').toUpperCase();
  }

  async confirmAssignmentContractData(): Promise<void> {
    if (!this.selectedDocument || !this.contractData?.requiereConfirmacion) return;
    const required: Array<keyof ProponerRepresentacionRequest> = [
      'ocupacion', 'nacionalidad', 'direccionCalle', 'direccionNumeroExterior',
      'direccionColonia', 'direccionMunicipio', 'direccionEstado', 'direccionCp', 'telefonos'
    ];
    if (required.some(field => !String(this.contractDataForm[field] ?? '').trim())) {
      await this.toast('Completa ocupación, nacionalidad, domicilio y teléfonos.', 'warning');
      return;
    }
    const rfc = this.normalizeRfc(this.contractDataForm.rfc);
    if (rfc && !/^[A-Z&Ñ]{4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc)) {
      await this.toast('El RFC debe contener 13 caracteres con formato de persona física.', 'warning');
      return;
    }
    this.contractDataForm.rfc = rfc;
    this.contractDataForm.ocupacion = this.normalizeText(this.contractDataForm.ocupacion);
    this.contractDataForm.nacionalidad = this.normalizeText(this.contractDataForm.nacionalidad);
    this.confirmingContractData = true;
    try {
      const response = await firstValueFrom(this.service.confirmarDatosContractuales(
        this.selectedDocument.idasignacion, this.contractDataForm));
      const refreshed = await firstValueFrom(this.service.datosContractuales(this.selectedDocument.idasignacion));
      this.setContractData(refreshed.result);
      await this.toast(response.result.todosConfirmados
        ? 'Datos confirmados. El contrato está listo para recopilar las firmas.'
        : `Datos confirmados. Faltan ${response.result.firmantesPendientes} firmante(s) por confirmar.`, 'success');
    } catch (error) {
      await this.toast(this.errorMessage(error, 'No fue posible confirmar los datos contractuales.'), 'danger');
    } finally {
      this.confirmingContractData = false;
    }
  }

  private setContractData(data: DatosContractualesAsignacion): void {
    this.contractData = data;
    this.contractDataForm = {
      ...this.emptyRepresentationForm(),
      ocupacion: data.ocupacion ?? '', nacionalidad: data.nacionalidad ?? '', rfc: data.rfc ?? '',
      direccionCalle: data.direccionCalle ?? '',
      direccionNumeroExterior: data.direccionNumeroExterior ?? '',
      direccionNumeroInterior: data.direccionNumeroInterior ?? '',
      direccionColonia: data.direccionColonia ?? '',
      direccionMunicipio: data.direccionMunicipio ?? '',
      direccionEstado: data.direccionEstado ?? '', direccionCp: data.direccionCp ?? '',
      direccionReferencia: data.direccionReferencia ?? '', telefonos: data.telefonos ?? '',
    };
  }

  initializeCanvas(): void {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    this.drawing = false;
    context.resetTransform();
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.beginPath();
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
    if (!canvas || !context || this.otp || this.savingSignature) return;
    canvas.setPointerCapture(event.pointerId);
    const point = this.canvasPoint(event, canvas);
    context.beginPath();
    context.moveTo(point.x, point.y);
    this.drawing = true;
  }

  drawSignature(event: PointerEvent): void {
    const canvas = this.signatureCanvas?.nativeElement;
    const context = canvas?.getContext('2d');
    if (!this.drawing || !canvas || !context || this.otp || this.savingSignature) return;
    const point = this.canvasPoint(event, canvas);
    context.lineTo(point.x, point.y);
    context.stroke();
    this.hasSignature = true;
  }

  stopSignature(): void { this.drawing = false; }
  clearSignature(): void { if (!this.otp && !this.savingSignature) this.initializeCanvas(); }

  async submitSignature(): Promise<void> {
    if (this.savingSignature || this.otp) return;
    if (!this.selectedDocument || !this.detail || !this.legalAccepted) {
      await this.toast('Confirma la declaración para continuar.', 'warning');
      return;
    }
    if (this.detail.requiereFirmaGrafica && !this.hasSignature) {
      await this.toast('Registra tu firma gráfica para continuar.', 'warning');
      return;
    }
    this.drawing = false;
    this.savingSignature = true;
    try {
      const response = this.detail.requiereFirmaGrafica
        ? await firstValueFrom(this.service.registrarFirma(
            this.selectedDocument.idasignacion, await this.canvasBlob()))
        : await firstValueFrom(this.service.registrarAceptacion(this.selectedDocument.idasignacion));
      this.otp = response.result;
      const codigoPrueba = this.mostrarOtpPrueba ? this.otp.codigoPrueba ?? '' : '';
      this.otpCode = codigoPrueba;
      const otpMessage = codigoPrueba
        ? 'Codigo OTP de prueba generado.'
        : `Codigo enviado a ${this.otp.destino}.`;
      await this.toast(otpMessage, 'success');
    } catch (error) {
      await this.toast(this.errorMessage(error, this.detail.requiereFirmaGrafica
        ? 'No fue posible registrar la firma.'
        : 'No fue posible registrar la aceptación.'), 'danger');
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
      await this.toast(
        this.detail?.requiereFirmaGrafica
          ? 'Firma confirmada correctamente.'
          : 'Aceptación confirmada correctamente.',
        'success');
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

  studentGroup(idmatricula: number): string {
    return this.context.alumnos.find(item => item.idmatricula === idmatricula)?.grupo?.trim() || 'Sin grupo asignado';
  }

  statusColor(status: string): string {
    const value = status.toUpperCase();
    if (['VIGENTE', 'FIRMADO', 'FIRMADA'].includes(value)) return 'success';
    if (['SUSPENDIDA', 'SUSPENDIDO', 'RECHAZADO', 'RECHAZADA', 'REVOCADA', 'BLOQUEADA_DISENSO'].includes(value)) return 'danger';
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

  private async restoreRepresentation(item: RepresentacionFamiliar): Promise<void> {
    if (this.restoringRepresentationId !== null) return;
    this.restoringRepresentationId = item.idrepresentacionlegal;
    try {
      const response = await firstValueFrom(this.service.restaurarRepresentacion(item.idrepresentacionlegal));
      await this.toast(response.message || 'Representación restaurada correctamente.', 'success');
      await this.load();
    } catch (error) {
      await this.toast(this.errorMessage(error, 'No fue posible restaurar la representación.'), 'danger');
    } finally {
      this.restoringRepresentationId = null;
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
    // CSS backgrounds are not exported. Flatten a stable copy onto white pixels.
    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    const context = output.getContext('2d');
    if (!context) return Promise.reject(new Error('No fue posible preparar la imagen de firma.'));
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(canvas, 0, 0);
    return new Promise((resolve, reject) => output.toBlob(
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

  private emptyRepresentationForm(): ProponerRepresentacionRequest {
    return {
      idmatricula: 0, idfamiliamiembro: 0, claveCalidad: '', fechaInicio: null, fechaFin: null,
      observaciones: '', ocupacion: '', nacionalidad: '', rfc: '',
      direccionCalle: '', direccionNumeroExterior: '', direccionNumeroInterior: '',
      direccionColonia: '', direccionMunicipio: '', direccionEstado: '', direccionCp: '',
      direccionReferencia: '', telefonos: ''
    };
  }

  updateRepresentationIdentity(field:
    'ocupacion' | 'nacionalidad' | 'rfc' | 'direccionCalle' | 'direccionNumeroExterior' |
    'direccionNumeroInterior' | 'direccionColonia' | 'direccionMunicipio' | 'direccionEstado' |
    'direccionCp' | 'direccionReferencia' | 'telefonos', event: CustomEvent): void {
    this.representationForm[field] = String(event.detail?.value ?? '').toUpperCase();
  }

  private normalizeText(value?: string | null): string | null {
    return value?.trim().toUpperCase() || null;
  }

  private normalizeRfc(value?: string | null): string {
    return value?.replace(/[\s-]/g, '').toUpperCase() ?? '';
  }

  private qualityForRelationship(relationship?: string): string | null {
    if (relationship === 'PADRE') return 'PADRE';
    if (relationship === 'MADRE') return 'MADRE';
    if (relationship === 'TUTOR') return 'TUTOR_LEGAL';
    return null;
  }

  private errorMessage(error: unknown, fallback: string): string {
    const apiMessage = (error as { error?: { message?: unknown } } | null)?.error?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
    return error instanceof Error && error.message ? error.message : fallback;
  }

  private async toast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({ message, color, duration: 3200, position: 'bottom' });
    await toast.present();
  }
}
