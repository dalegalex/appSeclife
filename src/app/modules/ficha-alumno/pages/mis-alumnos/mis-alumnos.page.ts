import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { AlertController, ToastController } from '@ionic/angular';
import {
  DomicilioFamiliarContexto,
  DomicilioFamiliarHermano,
  FichaAlumnoAutorizacion,
  FichaAlumnoDetalle,
  FichaAlumnoDocumento,
  FichaAlumnoResumen,
  RegistrarDocumentoAlumnoRequest,
} from '../../models/ficha-alumno.model';
import { FichaAlumnoService } from '../../services/ficha-alumno.service';

type AlumnoFichaTab = 'inscripcion' | 'contacto' | 'medica' | 'academica' | 'documentos' | 'autorizaciones' | 'servicios';

@Component({
  selector: 'app-mis-alumnos-ficha',
  templateUrl: './mis-alumnos.page.html',
  styleUrls: ['./mis-alumnos.page.scss'],
  standalone: false,
})
export class MisAlumnosFichaPage implements OnInit {
  readonly tabs: Array<{ value: AlumnoFichaTab; label: string }> = [
    { value: 'inscripcion', label: 'Inscripcion' },
    { value: 'contacto', label: 'Contacto' },
    { value: 'medica', label: 'Medica' },
    { value: 'academica', label: 'Academica' },
    { value: 'documentos', label: 'Documentos' },
    { value: 'autorizaciones', label: 'Autorizaciones' },
    { value: 'servicios', label: 'Servicios' },
  ];

  activeTab: AlumnoFichaTab = 'inscripcion';
  alumnos: FichaAlumnoResumen[] = [];
  selectedIdmatricula: number | null = null;
  detalle: FichaAlumnoDetalle | null = null;
  cargando = false;
  guardando = false;
  documentoUploading: number | null = null;
  documentoOpening: number | null = null;
  autorizacionSaving: number | null = null;
  domicilioFamiliarContexto: DomicilioFamiliarContexto | null = null;
  domicilioFamiliarActivo = false;
  domicilioFamiliarCargando = false;
  readonly idmatriculasDomicilioSeleccionadas = new Set<number>();

  readonly fichaForm = new FormGroup({
    direccionCalle: new FormControl<string | null>(null),
    direccionNumero: new FormControl<string | null>(null),
    direccionNumeroInterior: new FormControl<string | null>(null),
    direccionColonia: new FormControl<string | null>(null),
    direccionMunicipio: new FormControl<string | null>(null),
    direccionEstado: new FormControl<string | null>(null),
    direccionCp: new FormControl<string | null>(null),
    referenciaDomicilio: new FormControl<string | null>(null),
    telefonoCasa: new FormControl<string | null>(null),
    emailInstitucional: new FormControl<string | null>(null),
    emailPersonal: new FormControl<string | null>(null),
    tipoSangre: new FormControl<string | null>(null),
    alergias: new FormControl<string | null>(null),
    enfermedadesCronicas: new FormControl<string | null>(null),
    medicamentosPermanentes: new FormControl<string | null>(null),
    discapacidad: new FormControl<string | null>(null),
    necesidadEspecial: new FormControl<string | null>(null),
    medicoFamiliar: new FormControl<string | null>(null),
    telefonoMedico: new FormControl<string | null>(null),
    hospitalPreferente: new FormControl<string | null>(null),
    seguroMedico: new FormControl<string | null>(null),
    polizaSeguro: new FormControl<string | null>(null),
    observacionesEnfermeria: new FormControl<string | null>(null),
  });

  constructor(
    private readonly fichaAlumnoService: FichaAlumnoService,
    private readonly toastController: ToastController,
    private readonly alertController: AlertController
  ) {}

  ngOnInit(): void {
    this.cargarAlumnos();
  }

  get selectedAlumno(): FichaAlumnoResumen | null {
    return this.alumnos.find((alumno) => alumno.idmatricula === this.selectedIdmatricula) ?? null;
  }

  get studentPhotoSrc(): string | null {
    return this.normalizePhoto(this.detalle?.alumno?.foto ?? this.selectedAlumno?.foto);
  }

  get puedeGuardar(): boolean {
    return this.activeTab === 'contacto' || this.activeTab === 'medica';
  }

  cargarAlumnos(event?: { target?: { complete?: () => void } }): void {
    this.cargando = true;
    this.fichaAlumnoService.listarMisAlumnos().subscribe({
      next: async (response) => {
        this.alumnos = response.result ?? [];
        this.cargando = false;
        event?.target?.complete?.();

        if (!this.alumnos.length) {
          await this.presentToast('No se localizaron alumnos vinculados a tu familia.', 'warning');
          return;
        }

        const idmatricula = this.selectedIdmatricula ?? this.alumnos[0].idmatricula;
        this.seleccionarAlumno(idmatricula);
      },
      error: async (error) => {
        this.cargando = false;
        event?.target?.complete?.();
        await this.presentToast(this.errorMessage(error, 'No fue posible consultar tus alumnos.'), 'danger');
      },
    });
  }

  seleccionarAlumno(idmatricula: number | string | null | undefined): void {
    const parsed = Number(idmatricula);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    this.selectedIdmatricula = parsed;
    this.reiniciarDomicilioFamiliar();
    this.cargarFicha(parsed);
  }

  cargarFicha(idmatricula: number): void {
    this.cargando = true;
    this.fichaAlumnoService.consultarMiAlumno(idmatricula).subscribe({
      next: (response) => {
        this.detalle = response.result;
        this.patchForm();
        this.cargando = false;
        this.cargarContextoDomicilioFamiliar(idmatricula);
      },
      error: async (error) => {
        this.cargando = false;
        await this.presentToast(this.errorMessage(error, 'No fue posible consultar la ficha del alumno.'), 'danger');
      },
    });
  }

  async guardar(): Promise<void> {
    if (!this.selectedIdmatricula || !this.puedeGuardar) return;

    const payload = this.uppercasePayload(this.fichaForm.getRawValue());
    if (this.activeTab === 'contacto' && this.domicilioFamiliarActivo) {
      await this.confirmarDomicilioFamiliar(payload);
      return;
    }

    this.guardarFichaIndividual(payload);
  }

  onDomicilioFamiliarChange(event: CustomEvent): void {
    const activo = Boolean(event.detail?.checked);
    if (!activo) {
      this.domicilioFamiliarActivo = false;
      this.idmatriculasDomicilioSeleccionadas.clear();
      return;
    }

    if (!this.domicilioFamiliarContexto?.puedeAdministrar) {
      void this.presentToast('Solo el master o un familiar con permiso para administrar puede usar esta opción.', 'warning');
      return;
    }

    this.domicilioFamiliarActivo = true;
    this.idmatriculasDomicilioSeleccionadas.clear();
    for (const hermano of this.domicilioFamiliarContexto.hermanos) {
      if (!hermano.tieneDomicilio) this.idmatriculasDomicilioSeleccionadas.add(hermano.idmatricula);
    }
  }

  onHermanoDomicilioChange(hermano: DomicilioFamiliarHermano, event: CustomEvent): void {
    if (event.detail?.checked) {
      this.idmatriculasDomicilioSeleccionadas.add(hermano.idmatricula);
    } else {
      this.idmatriculasDomicilioSeleccionadas.delete(hermano.idmatricula);
    }
  }

  hermanoDomicilioSeleccionado(idmatricula: number): boolean {
    return this.idmatriculasDomicilioSeleccionadas.has(idmatricula);
  }

  trackByHermanoDomicilio(_index: number, hermano: DomicilioFamiliarHermano): number {
    return hermano.idmatricula;
  }

  private guardarFichaIndividual(payload: Record<string, unknown>): void {
    if (!this.selectedIdmatricula) return;
    this.guardando = true;
    this.fichaAlumnoService.guardarMiAlumnoFicha(this.selectedIdmatricula, payload).subscribe({
      next: async (response) => {
        this.guardando = false;
        await this.presentToast(response.message ?? 'Ficha guardada correctamente.', 'success');
        this.refrescarSinCambiarTab();
      },
      error: async (error) => {
        this.guardando = false;
        await this.presentToast(this.errorMessage(error, 'No fue posible guardar la ficha.'), 'danger');
      },
    });
  }

  private cargarContextoDomicilioFamiliar(idmatricula: number): void {
    if (this.alumnos.length < 2) {
      this.domicilioFamiliarContexto = null;
      return;
    }

    this.domicilioFamiliarCargando = true;
    this.fichaAlumnoService.consultarDomicilioFamiliar(idmatricula).subscribe({
      next: (response) => {
        if (this.selectedIdmatricula !== idmatricula) return;
        this.domicilioFamiliarContexto = response.result;
        this.domicilioFamiliarCargando = false;
      },
      error: () => {
        if (this.selectedIdmatricula !== idmatricula) return;
        this.domicilioFamiliarContexto = null;
        this.domicilioFamiliarCargando = false;
      },
    });
  }

  private async confirmarDomicilioFamiliar(payload: Record<string, unknown>): Promise<void> {
    const contexto = this.domicilioFamiliarContexto;
    const destinos = contexto?.hermanos.filter((hermano) =>
      this.idmatriculasDomicilioSeleccionadas.has(hermano.idmatricula)) ?? [];

    if (!destinos.length) {
      await this.presentToast('Selecciona al menos un hermano para aplicar el domicilio.', 'warning');
      return;
    }

    const reemplazos = destinos.filter((hermano) => hermano.tieneDomicilio).length;
    const nombres = destinos.map((hermano) => `- ${hermano.nombreCompleto}`).join('\n');
    const advertencia = reemplazos
      ? `\n\nATENCIÓN: ${reemplazos} ficha(s) ya tienen domicilio y serán reemplazadas.`
      : '';
    const alert = await this.alertController.create({
      header: 'Aplicar domicilio a hermanos',
      message: `Se copiará el domicilio a:\n\n${nombres}${advertencia}`,
      cssClass: 'family-address-confirmation',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Aplicar', role: 'confirm' },
      ],
    });

    await alert.present();
    const result = await alert.onDidDismiss();
    if (result.role !== 'confirm' || !this.selectedIdmatricula) return;

    this.guardando = true;
    this.fichaAlumnoService.aplicarDomicilioFamiliar(this.selectedIdmatricula, {
      ...(payload as object),
      idmatriculasDestino: destinos.map((hermano) => hermano.idmatricula),
      direccionNumeroExterior: String(payload['direccionNumero'] ?? '') || null,
    }).subscribe({
      next: async (response) => {
        this.guardando = false;
        this.reiniciarDomicilioFamiliar();
        await this.presentToast(response.message ?? 'Domicilio familiar aplicado correctamente.', 'success');
        this.refrescarSinCambiarTab();
        this.cargarContextoDomicilioFamiliar(this.selectedIdmatricula as number);
      },
      error: async (error) => {
        this.guardando = false;
        await this.presentToast(this.errorMessage(error, 'No fue posible aplicar el domicilio familiar.'), 'danger');
      },
    });
  }

  private reiniciarDomicilioFamiliar(): void {
    this.domicilioFamiliarActivo = false;
    this.domicilioFamiliarContexto = null;
    this.domicilioFamiliarCargando = false;
    this.idmatriculasDomicilioSeleccionadas.clear();
  }

  seleccionarArchivo(doc: FichaAlumnoDocumento, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.subirDocumentoSeleccionado(doc, file, () => {
      input.value = '';
    });
  }

  abrirGaleria(doc: FichaAlumnoDocumento): void {
    this.abrirSelectorDocumento(doc, 'galeria');
  }

  abrirCamara(doc: FichaAlumnoDocumento): void {
    this.abrirSelectorDocumento(doc, 'camara');
  }

  private abrirSelectorDocumento(doc: FichaAlumnoDocumento, origen: 'galeria' | 'camara'): void {
    if (!this.puedeModificarDocumento(doc)) {
      void this.presentToast('El documento validado no puede modificarse.', 'warning');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = origen === 'camara' ? 'image/*' : 'image/*,.pdf';

    if (origen === 'camara') {
      input.setAttribute('capture', 'environment');
    }

    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';

    input.onchange = () => {
      const file = input.files?.[0];

      if (file) {
        this.subirDocumentoSeleccionado(doc, file, () => input.remove());
        return;
      }

      input.remove();
    };

    document.body.appendChild(input);
    input.click();
  }

  private subirDocumentoSeleccionado(doc: FichaAlumnoDocumento, file: File, onFinish?: () => void): void {
    if (!this.selectedIdmatricula) {
      onFinish?.();
      return;
    }

    if (!this.puedeModificarDocumento(doc)) {
      onFinish?.();
      void this.presentToast('El documento validado no puede modificarse.', 'warning');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      onFinish?.();
      void this.presentToast('El documento excede el tamano permitido de 15 MB.', 'danger');
      return;
    }

    const reader = new FileReader();
    this.documentoUploading = doc.idctalumnofichadocumento;

    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const separatorIndex = dataUrl.indexOf(',');
      const documentoBase64 = separatorIndex >= 0 ? dataUrl.substring(separatorIndex + 1) : dataUrl;
      const request: RegistrarDocumentoAlumnoRequest = {
        idctalumnofichadocumento: doc.idctalumnofichadocumento,
        documentoNombre: file.name,
        documentoContentType: file.type,
        documentoTamanoBytes: file.size,
        documentoBase64,
      };

      this.fichaAlumnoService.registrarDocumento(this.selectedIdmatricula as number, request).subscribe({
        next: async (response) => {
          onFinish?.();
          this.documentoUploading = null;
          await this.presentToast(response.message ?? 'Documento enviado correctamente.', 'success');
          this.refrescarSinCambiarTab();
        },
        error: async (error) => {
          onFinish?.();
          this.documentoUploading = null;
          await this.presentToast(this.errorMessage(error, 'No fue posible subir el documento.'), 'danger');
        },
      });
    };

    reader.onerror = async () => {
      onFinish?.();
      this.documentoUploading = null;
      await this.presentToast('No fue posible leer el archivo seleccionado.', 'danger');
    };

    reader.readAsDataURL(file);
  }

  async eliminarDocumento(doc: FichaAlumnoDocumento): Promise<void> {
    if (!this.selectedIdmatricula || !doc.idalumnofichadocumento) {
      await this.presentToast('Este documento aun no tiene archivo asociado.', 'warning');
      return;
    }

    if (this.documentoValidado(doc)) {
      await this.presentToast('El documento validado no puede eliminarse.', 'warning');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Eliminar documento',
      message: `Se quitara el archivo asociado a ${doc.descripcion}.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.documentoUploading = doc.idctalumnofichadocumento;
            this.fichaAlumnoService.eliminarDocumento(
              this.selectedIdmatricula as number,
              doc.idalumnofichadocumento as number
            ).subscribe({
              next: async (response) => {
                this.documentoUploading = null;
                await this.presentToast(response.message ?? 'Documento eliminado correctamente.', 'success');
                this.refrescarSinCambiarTab();
              },
              error: async (error) => {
                this.documentoUploading = null;
                await this.presentToast(this.errorMessage(error, 'No fue posible eliminar el documento.'), 'danger');
              },
            });
          },
        },
      ],
    });

    await alert.present();
  }

  abrirDocumento(doc: FichaAlumnoDocumento): void {
    if (!doc.idalumnofichadocumento) {
      void this.presentToast('Este documento aun no tiene archivo asociado.', 'warning');
      return;
    }

    if (this.documentoOpening === doc.idalumnofichadocumento) {
      return;
    }

    console.log('[MisAlumnosFichaPage] abrirDocumento request', {
      idalumnofichadocumento: doc.idalumnofichadocumento,
      idctalumnofichadocumento: doc.idctalumnofichadocumento,
      clave: doc.clave,
      descripcion: doc.descripcion,
      documentoNombre: doc.documentoNombre,
      documentoContentType: doc.documentoContentType,
      documentoTamanoBytes: doc.documentoTamanoBytes,
      documentoDigitalizado: doc.documentoDigitalizado,
      documentoUrl: doc.documentoUrl,
      native: Capacitor.isNativePlatform(),
    });

    const target = Capacitor.isNativePlatform() ? null : window.open('', '_blank');
    this.documentoOpening = doc.idalumnofichadocumento;

    this.fichaAlumnoService
      .consultarDocumentoArchivo(doc.idalumnofichadocumento, doc.documentoContentType)
      .subscribe({
        next: async (archivo) => {
          try {
            console.log('[MisAlumnosFichaPage] abrirDocumento result', {
              idalumnofichadocumento: doc.idalumnofichadocumento,
              size: archivo.size,
              type: archivo.type,
            });

            if (Capacitor.isNativePlatform()) {
              await this.abrirArchivoNativo(
                archivo,
                doc.documentoNombre || `documento-alumno-${doc.idalumnofichadocumento}`,
                doc.documentoContentType || archivo.type || 'application/octet-stream',
                'No fue posible abrir el documento.'
              );
              return;
            }

            this.abrirArchivoWeb(archivo, target);
          } finally {
            this.documentoOpening = null;
          }
        },
        error: async (error) => {
          this.documentoOpening = null;
          console.error('[MisAlumnosFichaPage] abrirDocumento error', {
            idalumnofichadocumento: doc.idalumnofichadocumento,
            error,
          });
          target?.close();
          await this.presentToast(this.errorMessage(error, 'No fue posible abrir el documento.'), 'danger');
        },
      });
  }

  abrirConstanciaAutorizacion(autorizacion: FichaAlumnoAutorizacion): void {
    if (!autorizacion.idalumnofichaautorizacion || !this.autorizacionRespondida(autorizacion)) {
      void this.presentToast('La constancia estara disponible cuando registres tu respuesta.', 'warning');
      return;
    }

    const target = Capacitor.isNativePlatform() ? null : window.open('', '_blank');

    this.fichaAlumnoService.consultarAutorizacionPdf(autorizacion.idalumnofichaautorizacion).subscribe({
      next: async (pdf) => {
        if (Capacitor.isNativePlatform()) {
          await this.abrirPdfNativo(pdf, autorizacion);
          return;
        }

        this.abrirPdfWeb(pdf, target);
      },
      error: async (error) => {
        target?.close();
        await this.presentToast(this.errorMessage(error, 'No fue posible abrir la constancia.'), 'danger');
      },
    });
  }

  abrirAdjuntoAutorizacion(autorizacion: FichaAlumnoAutorizacion): void {
    if (!autorizacion.iddocumentodigitaladjunto) {
      void this.presentToast('La autorizacion no tiene documento adjunto disponible.', 'warning');
      return;
    }

    const target = Capacitor.isNativePlatform() ? null : window.open('', '_blank');

    this.fichaAlumnoService
      .consultarAutorizacionAdjunto(autorizacion.iddocumentodigitaladjunto, autorizacion.adjuntoContentType)
      .subscribe({
        next: async (archivo) => {
          if (Capacitor.isNativePlatform()) {
            await this.abrirArchivoNativo(
              archivo,
              autorizacion.adjuntoNombre || `documento-adjunto-${autorizacion.iddocumentodigitaladjunto}`,
              autorizacion.adjuntoContentType || archivo.type || 'application/octet-stream',
              'No fue posible abrir el documento adjunto.'
            );
            return;
          }

          this.abrirArchivoWeb(archivo, target);
        },
        error: async (error) => {
          target?.close();
          await this.presentToast(this.errorMessage(error, 'No fue posible abrir el documento adjunto.'), 'danger');
        },
      });
  }

  responderAutorizacion(autorizacion: FichaAlumnoAutorizacion, respuesta: 'ACEPTADO' | 'RECHAZADO'): void {
    if (!this.selectedIdmatricula) return;

    if (this.autorizacionValidada(autorizacion)) {
      void this.presentToast('La autorizacion ya fue validada por el Colegio. Solicita su liberacion para cambiarla.', 'warning');
      return;
    }

    if (respuesta === 'RECHAZADO' && autorizacion.permiteRechazo === false) {
      void this.presentToast('Esta autorizacion no permite rechazo desde la app.', 'warning');
      return;
    }

    this.autorizacionSaving = autorizacion.idctalumnofichaautorizacion;
    this.fichaAlumnoService.responderAutorizacion(this.selectedIdmatricula, {
      idctalumnofichaautorizacion: autorizacion.idctalumnofichaautorizacion,
      respuesta,
      observaciones: null,
    }).subscribe({
      next: async (response) => {
        this.autorizacionSaving = null;
        await this.presentToast(response.message ?? 'Respuesta registrada correctamente.', 'success');
        this.refrescarSinCambiarTab();
      },
      error: async (error) => {
        this.autorizacionSaving = null;
        await this.presentToast(this.errorMessage(error, 'No fue posible registrar la respuesta.'), 'danger');
      },
    });
  }

  documentos(): FichaAlumnoDocumento[] {
    return this.detalle?.documentos ?? [];
  }

  autorizaciones(): FichaAlumnoAutorizacion[] {
    return this.detalle?.autorizaciones ?? [];
  }

  tieneAdjuntoAutorizacion(autorizacion: FichaAlumnoAutorizacion): boolean {
    return Boolean(autorizacion.iddocumentodigitaladjunto && autorizacion.adjuntoNombre);
  }

  versionAutorizacionLabel(autorizacion: FichaAlumnoAutorizacion): string {
    const parts = [
      autorizacion.versionTexto ? `Version ${autorizacion.versionTexto}` : null,
      autorizacion.vigenteDesde ? `vigente desde ${this.formatDate(autorizacion.vigenteDesde)}` : null,
    ].filter(Boolean);

    return parts.join(' - ');
  }

  adjuntoAutorizacionLabel(autorizacion: FichaAlumnoAutorizacion): string {
    return [
      autorizacion.adjuntoNombre,
      this.formatBytes(autorizacion.adjuntoTamanoBytes),
    ].filter(Boolean).join(' - ');
  }

  hashShort(hash?: string | null): string {
    const value = (hash ?? '').trim();
    if (!value) {
      return '';
    }

    return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-8)}` : value;
  }

  private abrirPdfWeb(pdf: Blob, target: Window | null): void {
    this.abrirArchivoWeb(pdf, target);
  }

  private abrirArchivoWeb(archivo: Blob, target: Window | null): void {
    const url = URL.createObjectURL(archivo);
    if (target) {
      target.location.href = url;
    } else {
      window.open(url, '_blank');
    }
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  private async abrirPdfNativo(pdf: Blob, autorizacion: FichaAlumnoAutorizacion): Promise<void> {
    const id = autorizacion.idalumnofichaautorizacion ?? Date.now();
    await this.abrirArchivoNativo(
      pdf,
      `seclife-constancia-autorizacion-${id}.pdf`,
      'application/pdf',
      'No fue posible abrir la constancia.'
    );
  }

  private async abrirArchivoNativo(archivo: Blob, fileName: string, mimeType: string, fallbackError: string): Promise<void> {
    try {
      const base64 = await this.blobToBase64(archivo);
      const path = this.safeFileName(fileName);
      const result = await Filesystem.writeFile({
        path,
        data: base64,
        directory: Directory.Cache,
      });

      if (!result.uri) {
        throw new Error('No fue posible preparar el archivo PDF.');
      }

      await FileOpener.openFile({
        path: result.uri,
        mimeType,
      });
    } catch (error) {
      await this.presentToast(this.errorMessage(error, fallbackError), 'danger');
    }
  }

  private safeFileName(fileName: string): string {
    const value = (fileName || 'documento').trim();
    return value.replace(/[\\/:*?"<>|]+/g, '-');
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result ?? '');
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = () => reject(reader.error ?? new Error('No fue posible leer el archivo PDF.'));
      reader.readAsDataURL(blob);
    });
  }

  autorizacionRespondida(autorizacion: FichaAlumnoAutorizacion): boolean {
    return ['ACEPTADO', 'RECHAZADO', 'REVOCADO'].includes((autorizacion.respuesta ?? '').toUpperCase());
  }

  autorizacionValidada(autorizacion: FichaAlumnoAutorizacion): boolean {
    return (autorizacion.estatusValidacion ?? '').toUpperCase() === 'VALIDADO';
  }

  respuestaLabel(respuesta?: string | null): string {
    const estatus = (respuesta ?? 'PENDIENTE').toUpperCase();

    if (estatus === 'RECHAZADO') {
      return 'NO ACEPTO';
    }

    if (estatus === 'ACEPTADO') {
      return 'ACEPTO';
    }

    return estatus;
  }

  validationLabel(autorizacion: FichaAlumnoAutorizacion): string {
    const estatus = (autorizacion.estatusValidacion ?? '').toUpperCase();

    if (!estatus || estatus === 'NO_REQUIERE') {
      return '';
    }

    if (estatus === 'PENDIENTE') {
      return 'Validacion del Colegio pendiente.';
    }

    return `Validacion del Colegio: ${estatus}.`;
  }

  observacionColegio(autorizacion: FichaAlumnoAutorizacion): string {
    const estatus = (autorizacion.estatusValidacion ?? '').toUpperCase();
    const observacion = (autorizacion.observaciones ?? '').trim();

    if (estatus !== 'OBSERVADO' || !observacion) {
      return '';
    }

    return observacion;
  }

  tieneArchivo(doc: FichaAlumnoDocumento): boolean {
    return Boolean(doc.idalumnofichadocumento && (doc.documentoDigitalizado || doc.documentoUrl || doc.documentoNombre));
  }

  documentoValidado(doc: FichaAlumnoDocumento): boolean {
    return (doc.estatus ?? '').toUpperCase() === 'VALIDADO';
  }

  puedeModificarDocumento(doc: FichaAlumnoDocumento): boolean {
    return !this.documentoValidado(doc) && this.documentoUploading !== doc.idctalumnofichadocumento;
  }

  private formatDate(value?: string | null): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  private formatBytes(value?: number | null): string {
    if (!value || value <= 0) {
      return '';
    }

    if (value < 1024 * 1024) {
      return `${Math.round(value / 1024)} KB`;
    }

    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  statusColor(status?: string | null): string {
    switch ((status ?? 'PENDIENTE').toUpperCase()) {
      case 'VALIDADO':
      case 'ACEPTADO':
      case 'NO_REQUIERE':
        return 'success';
      case 'OBSERVADO':
      case 'PENDIENTE':
        return 'warning';
      case 'RECHAZADO':
      case 'REVOCADO':
        return 'danger';
      case 'ENTREGADO':
        return 'primary';
      default:
        return 'medium';
    }
  }

  trackByAlumno(_: number, alumno: FichaAlumnoResumen): number {
    return alumno.idmatricula;
  }

  trackByDocumento(_: number, doc: FichaAlumnoDocumento): number {
    return doc.idctalumnofichadocumento;
  }

  trackByAutorizacion(_: number, autorizacion: FichaAlumnoAutorizacion): number {
    return autorizacion.idctalumnofichaautorizacion;
  }

  value(...keys: string[]): string {
    const ficha = this.detalle?.ficha as Record<string, unknown> | null;
    if (!ficha) return '';

    for (const key of keys) {
      const value = ficha[key];
      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value);
      }
    }

    return '';
  }

  boolValue(...keys: string[]): boolean {
    const value = this.value(...keys);
    return value === 'true' || value === '1';
  }

  private refrescarSinCambiarTab(): void {
    const currentTab = this.activeTab;
    if (!this.selectedIdmatricula) return;

    this.fichaAlumnoService.consultarMiAlumno(this.selectedIdmatricula).subscribe({
      next: (response) => {
        this.detalle = response.result;
        this.patchForm();
        this.activeTab = currentTab;
      },
    });
  }

  private patchForm(): void {
    this.fichaForm.patchValue({
      direccionCalle: this.value('direccionCalle', 'direccion_calle'),
      direccionNumero: this.value('direccionNumero', 'direccion_numero'),
      direccionNumeroInterior: this.value('direccionNumeroInterior', 'direccion_numero_interior'),
      direccionColonia: this.value('direccionColonia', 'direccion_colonia'),
      direccionMunicipio: this.value('direccionMunicipio', 'direccion_municipio'),
      direccionEstado: this.value('direccionEstado', 'direccion_estado'),
      direccionCp: this.value('direccionCp', 'direccion_cp'),
      referenciaDomicilio: this.value('referenciaDomicilio', 'referencia_domicilio'),
      telefonoCasa: this.value('telefonoCasa', 'telefono_casa'),
      emailInstitucional: this.value('emailInstitucional', 'email_institucional'),
      emailPersonal: this.value('emailPersonal', 'email_personal'),
      tipoSangre: this.value('tipoSangre', 'tipo_sangre'),
      alergias: this.value('alergias'),
      enfermedadesCronicas: this.value('enfermedadesCronicas', 'enfermedades_cronicas'),
      medicamentosPermanentes: this.value('medicamentosPermanentes', 'medicamentos_permanentes'),
      discapacidad: this.value('discapacidad'),
      necesidadEspecial: this.value('necesidadEspecial', 'necesidad_especial'),
      medicoFamiliar: this.value('medicoFamiliar', 'medico_familiar'),
      telefonoMedico: this.value('telefonoMedico', 'telefono_medico'),
      hospitalPreferente: this.value('hospitalPreferente', 'hospital_preferente'),
      seguroMedico: this.value('seguroMedico', 'seguro_medico'),
      polizaSeguro: this.value('polizaSeguro', 'poliza_seguro'),
      observacionesEnfermeria: this.value('observacionesEnfermeria', 'observaciones_enfermeria'),
    });
  }

  private uppercasePayload<T extends Record<string, unknown>>(payload: T): T {
    return Object.entries(payload).reduce((acc, [key, value]) => {
      if (typeof value !== 'string') {
        acc[key as keyof T] = value as T[keyof T];
        return acc;
      }

      const normalized = value.trim();
      if (!normalized) {
        acc[key as keyof T] = null as T[keyof T];
        return acc;
      }

      const normalizedValue = key === 'emailInstitucional' || key === 'emailPersonal'
        ? normalized.toLowerCase()
        : normalized.toUpperCase();
      acc[key as keyof T] = normalizedValue as T[keyof T];
      return acc;
    }, {} as T);
  }

  private normalizePhoto(value?: string | null): string | null {
    const foto = (value ?? '').trim();
    if (!foto) {
      return null;
    }

    if (/^(data:image\/|https?:\/\/)/i.test(foto)) {
      return foto;
    }

    return `data:${this.detectPhotoContentType(foto)};base64,${foto}`;
  }

  private detectPhotoContentType(base64: string): string {
    const prefix = base64.slice(0, 16);
    if (prefix.startsWith('/9j/')) return 'image/jpeg';
    if (prefix.startsWith('iVBOR')) return 'image/png';
    if (prefix.startsWith('UklGR')) return 'image/webp';
    if (prefix.startsWith('R0lGOD')) return 'image/gif';
    return 'image/jpeg';
  }

  private errorMessage(error: any, fallback: string): string {
    const apiMessage = this.extractApiErrorMessage(error?.error);
    if (apiMessage) return apiMessage;
    if (error?.status === 0) return 'No fue posible conectar con el API. Revisa que GpsApi este iniciado y actualizado.';
    if (error?.status === 413) return 'El archivo es demasiado grande para enviarse desde la app.';
    const directMessage = this.extractApiErrorMessage(error?.message);
    if (directMessage) return directMessage;
    if (error?.status) return `GpsApi devolvio HTTP ${error.status} sin detalle.`;
    return fallback;
  }

  private extractApiErrorMessage(payload: unknown): string | null {
    if (typeof payload === 'string') {
      const value = payload.trim();
      if (!value) return null;

      if (value.startsWith('{') || value.startsWith('[')) {
        try {
          return this.extractApiErrorMessage(JSON.parse(value));
        } catch {
          return null;
        }
      }

      return value;
    }

    if (!payload || typeof payload !== 'object') return null;

    const response = payload as { message?: unknown; errors?: unknown };
    if (response.errors && typeof response.errors === 'object') {
      for (const messages of Object.values(response.errors as Record<string, unknown>)) {
        if (Array.isArray(messages)) {
          const message = messages.find((item): item is string => typeof item === 'string' && Boolean(item.trim()));
          if (message) return message;
        } else if (typeof messages === 'string' && messages.trim()) {
          return messages;
        }
      }
    }

    return typeof response.message === 'string' && response.message.trim()
      ? response.message
      : null;
  }

  private async presentToast(message: string, color: 'success' | 'warning' | 'danger' | 'medium'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2400,
      color,
      position: 'top',
    });
    await toast.present();
  }
}
