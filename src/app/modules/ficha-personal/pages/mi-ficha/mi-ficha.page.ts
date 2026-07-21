import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { AlertController, ToastController } from '@ionic/angular';
import {
  FichaPersonalDetalle,
  FichaPersonalDocumento,
  FichaPersonalExperiencia,
  GuardarExperienciaFichaRequest,
  RegistrarDocumentoFichaRequest,
} from '../../models/ficha-personal.model';
import { FichaPersonalService } from '../../services/ficha-personal.service';

type FichaTab = 'generales' | 'contacto' | 'academica' | 'curriculum' | 'administrativa' | 'documentos';

@Component({
  selector: 'app-mi-ficha',
  templateUrl: './mi-ficha.page.html',
  styleUrls: ['./mi-ficha.page.scss'],
  standalone: false,
})
export class MiFichaPage implements OnInit {
  readonly tabs: Array<{ value: FichaTab; label: string }> = [
    { value: 'generales', label: 'Generales' },
    { value: 'contacto', label: 'Contacto' },
    { value: 'academica', label: 'Academica' },
    { value: 'curriculum', label: 'Curriculum' },
    { value: 'administrativa', label: 'Admin.' },
    { value: 'documentos', label: 'Documentos' },
  ];

  activeTab: FichaTab = 'generales';
  cargando = false;
  guardando = false;
  documentoUploading: number | null = null;
  detalle: FichaPersonalDetalle | null = null;

  readonly fichaForm = new FormGroup({
    rfc: new FormControl<string | null>(null),
    numeroEmpleado: new FormControl<string | null>(null),
    fechaNacimiento: new FormControl<string | null>(null),
    sexo: new FormControl<string | null>(null),
    estadoCivil: new FormControl<string | null>(null),
    nacionalidad: new FormControl<string | null>(null),
    telefonoEmergencia: new FormControl<string | null>(null),
    emailInstitucional: new FormControl<string | null>(null),
    emailPersonal: new FormControl<string | null>(null),
    direccionCalle: new FormControl<string | null>(null),
    direccionNumero: new FormControl<string | null>(null),
    direccionColonia: new FormControl<string | null>(null),
    direccionCiudad: new FormControl<string | null>(null),
    direccionEstado: new FormControl<string | null>(null),
    direccionCp: new FormControl<string | null>(null),
    tipoPersonal: new FormControl<string | null>(null),
    puesto: new FormControl<string | null>(null),
    areaDepartamento: new FormControl<string | null>(null),
    turno: new FormControl<string | null>(null),
    tipoContrato: new FormControl<string | null>(null),
    fechaIngreso: new FormControl<string | null>(null),
    estatusLaboral: new FormControl<string | null>('ACTIVO'),
    nivelEstudios: new FormControl<string | null>(null),
    carreraEspecialidad: new FormControl<string | null>(null),
    institucionEducativa: new FormControl<string | null>(null),
    anioEgreso: new FormControl<number | null>(null),
    cedulaProfesional: new FormControl<string | null>(null),
    nss: new FormControl<string | null>(null),
    tipoSangre: new FormControl<string | null>(null),
    alergiasCondiciones: new FormControl<string | null>(null),
    banco: new FormControl<string | null>(null),
    clabeInterbancaria: new FormControl<string | null>(null),
  });

  readonly curriculumForm = new FormGroup({
    idusrfichaexperiencia: new FormControl<number | null>(null),
    tipo: new FormControl<string>('EMPLEO'),
    empresaInstitucion: new FormControl<string | null>(null),
    puesto: new FormControl<string | null>(null),
    periodo: new FormControl<string | null>(null),
    descripcion: new FormControl<string | null>(null),
    orden: new FormControl<number | null>(0),
  });

  constructor(
    private readonly fichaService: FichaPersonalService,
    private readonly alertController: AlertController,
    private readonly toastController: ToastController
  ) {}

  ngOnInit(): void {
    this.cargarFicha();
  }

  cargarFicha(): void {
    this.cargando = true;

    this.fichaService.consultarMiFicha().subscribe({
      next: (response) => {
        this.detalle = response.result;
        this.patchForm();
        this.cargando = false;
      },
      error: async (error) => {
        this.cargando = false;
        await this.presentToast(error?.error?.message ?? 'No fue posible consultar tu ficha.', 'danger');
      },
    });
  }

  guardar(): void {
    this.guardando = true;
    const payload = this.buildFichaPayload();

    this.fichaService.guardarMiFicha(payload).subscribe({
      next: async (response) => {
        this.guardando = false;
        await this.presentToast(response.message ?? 'Ficha guardada correctamente.', 'success');
        this.refrescarSinCambiarTab();
      },
      error: async (error) => {
        this.guardando = false;
        await this.presentToast(error?.error?.message ?? 'No fue posible guardar tu ficha.', 'danger');
      },
    });
  }

  seleccionarArchivo(doc: FichaPersonalDocumento, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (!this.puedeModificarDocumento(doc)) {
      input.value = '';
      void this.presentToast('El documento validado no puede modificarse.', 'warning');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      input.value = '';
      void this.presentToast('El documento excede el tamano permitido de 15 MB.', 'danger');
      return;
    }

    const reader = new FileReader();
    this.documentoUploading = doc.idctusrfichadocumento;

    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const separatorIndex = dataUrl.indexOf(',');
      const documentoBase64 = separatorIndex >= 0 ? dataUrl.substring(separatorIndex + 1) : dataUrl;

      const request: RegistrarDocumentoFichaRequest = {
        idctusrfichadocumento: doc.idctusrfichadocumento,
        documentoNombre: file.name,
        documentoContentType: file.type,
        documentoTamanoBytes: file.size,
        documentoBase64,
      };

      this.fichaService.registrarMiDocumento(request).subscribe({
        next: async (response) => {
          input.value = '';
          this.documentoUploading = null;
          await this.presentToast(response.message ?? 'Documento enviado correctamente.', 'success');
          this.refrescarSinCambiarTab();
        },
        error: async (error) => {
          input.value = '';
          this.documentoUploading = null;
          await this.presentToast(this.resolveErrorMessage(error, 'No fue posible subir el documento.'), 'danger');
        },
      });
    };

    reader.onerror = async () => {
      input.value = '';
      this.documentoUploading = null;
      await this.presentToast('No fue posible leer el archivo seleccionado.', 'danger');
    };

    reader.readAsDataURL(file);
  }

  guardarExperiencia(): void {
    const payload = this.uppercasePayload(this.curriculumForm.getRawValue()) as GuardarExperienciaFichaRequest;
    payload.tipo = payload.tipo || 'EMPLEO';

    this.fichaService.guardarMiExperiencia(payload).subscribe({
      next: async (response) => {
        await this.presentToast(response.message ?? 'Registro curricular guardado.', 'success');
        this.nuevaExperiencia(payload.tipo as string || 'EMPLEO');
        this.refrescarSinCambiarTab();
      },
      error: async (error) => {
        await this.presentToast(error?.error?.message ?? 'No fue posible guardar el registro curricular.', 'danger');
      },
    });
  }

  editarExperiencia(exp: FichaPersonalExperiencia): void {
    this.curriculumForm.patchValue({
      idusrfichaexperiencia: exp.idusrfichaexperiencia,
      tipo: exp.tipo,
      empresaInstitucion: exp.empresaInstitucion ?? null,
      puesto: exp.puesto ?? null,
      periodo: exp.periodo ?? null,
      descripcion: exp.descripcion ?? null,
      orden: exp.orden ?? 0,
    });
  }

  nuevaExperiencia(tipo = 'EMPLEO'): void {
    this.curriculumForm.reset({
      idusrfichaexperiencia: null,
      tipo,
      orden: 0,
    });
  }

  documentos(): FichaPersonalDocumento[] {
    return this.detalle?.documentos ?? [];
  }

  tieneArchivo(doc: FichaPersonalDocumento): boolean {
    return Boolean(doc.idusrfichadocumento && (doc.documentoDigitalizado || doc.documentoUrl || doc.documentoNombre));
  }

  documentoValidado(doc: FichaPersonalDocumento): boolean {
    return (doc.estatus ?? '').toUpperCase() === 'VALIDADO';
  }

  puedeModificarDocumento(doc: FichaPersonalDocumento): boolean {
    return !this.documentoValidado(doc) && this.documentoUploading !== doc.idctusrfichadocumento;
  }

  abrirDocumento(doc: FichaPersonalDocumento): void {
    if (!doc.idusrfichadocumento) {
      void this.presentToast('Este documento aun no tiene archivo asociado.', 'warning');
      return;
    }

    window.open(this.fichaService.documentoArchivoUrl(doc.idusrfichadocumento), '_blank');
  }

  async eliminarDocumento(doc: FichaPersonalDocumento): Promise<void> {
    if (!doc.idusrfichadocumento) {
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
            this.documentoUploading = doc.idctusrfichadocumento;
            this.fichaService.eliminarMiDocumento(doc.idusrfichadocumento as number).subscribe({
              next: async (response) => {
                this.documentoUploading = null;
                await this.presentToast(response.message ?? 'Documento eliminado correctamente.', 'success');
                this.refrescarSinCambiarTab();
              },
              error: async (error) => {
                this.documentoUploading = null;
                await this.presentToast(this.resolveErrorMessage(error, 'No fue posible eliminar el documento.'), 'danger');
              },
            });
          },
        },
      ],
    });

    await alert.present();
  }

  statusColor(doc: FichaPersonalDocumento): string {
    switch ((doc.estatus ?? 'PENDIENTE').toUpperCase()) {
      case 'VALIDADO': return 'success';
      case 'OBSERVADO': return 'warning';
      case 'RECHAZADO': return 'danger';
      case 'ENTREGADO': return 'primary';
      default: return 'medium';
    }
  }

  trackByDocumento(_: number, doc: FichaPersonalDocumento): number {
    return doc.idctusrfichadocumento;
  }

  private refrescarSinCambiarTab(): void {
    const currentTab = this.activeTab;

    this.fichaService.consultarMiFicha().subscribe({
      next: (response) => {
        this.detalle = response.result;
        this.patchForm();
        this.activeTab = currentTab;
      },
    });
  }

  private patchForm(): void {
    const ficha = this.detalle?.ficha ?? {};
    const usuario = this.detalle?.usuario;

    this.fichaForm.patchValue({
      rfc: this.value(ficha, 'rfc'),
      numeroEmpleado: this.value(ficha, 'numeroEmpleado', 'numero_empleado'),
      fechaNacimiento: this.onlyDate(this.value(ficha, 'fechaNacimiento', 'fecha_nacimiento')),
      sexo: this.value(ficha, 'sexo'),
      estadoCivil: this.value(ficha, 'estadoCivil', 'estado_civil'),
      nacionalidad: this.value(ficha, 'nacionalidad'),
      telefonoEmergencia: this.value(ficha, 'telefonoEmergencia', 'telefono_emergencia'),
      emailInstitucional: this.value(ficha, 'emailInstitucional', 'email_institucional') ?? usuario?.email ?? null,
      emailPersonal: this.value(ficha, 'emailPersonal', 'email_personal') ?? usuario?.emailgmail ?? null,
      direccionCalle: this.value(ficha, 'direccionCalle', 'direccion_calle'),
      direccionNumero: this.value(ficha, 'direccionNumero', 'direccion_numero'),
      direccionColonia: this.value(ficha, 'direccionColonia', 'direccion_colonia'),
      direccionCiudad: this.value(ficha, 'direccionCiudad', 'direccion_ciudad'),
      direccionEstado: this.value(ficha, 'direccionEstado', 'direccion_estado'),
      direccionCp: this.value(ficha, 'direccionCp', 'direccion_cp'),
      tipoPersonal: this.value(ficha, 'tipoPersonal', 'tipo_personal'),
      puesto: this.value(ficha, 'puesto') ?? usuario?.cargo ?? null,
      areaDepartamento: this.value(ficha, 'areaDepartamento', 'area_departamento'),
      turno: this.value(ficha, 'turno'),
      tipoContrato: this.value(ficha, 'tipoContrato', 'tipo_contrato'),
      fechaIngreso: this.onlyDate(this.value(ficha, 'fechaIngreso', 'fecha_ingreso') ?? usuario?.fecingreso),
      estatusLaboral: this.value(ficha, 'estatusLaboral', 'estatus_laboral') ?? 'ACTIVO',
      nivelEstudios: this.value(ficha, 'nivelEstudios', 'nivel_estudios'),
      carreraEspecialidad: this.value(ficha, 'carreraEspecialidad', 'carrera_especialidad'),
      institucionEducativa: this.value(ficha, 'institucionEducativa', 'institucion_educativa'),
      anioEgreso: Number(this.value(ficha, 'anioEgreso', 'anio_egreso')) || null,
      cedulaProfesional: this.value(ficha, 'cedulaProfesional', 'cedula_profesional'),
      nss: this.value(ficha, 'nss'),
      tipoSangre: this.value(ficha, 'tipoSangre', 'tipo_sangre'),
      alergiasCondiciones: this.value(ficha, 'alergiasCondiciones', 'alergias_condiciones'),
      banco: this.value(ficha, 'banco'),
      clabeInterbancaria: this.value(ficha, 'clabeInterbancaria', 'clabe_interbancaria'),
    });
  }

  private value(source: Record<string, unknown>, ...keys: string[]): string | null {
    for (const key of keys) {
      const value = source[key];
      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value);
      }
    }

    return null;
  }

  private onlyDate(value?: string | null): string | null {
    return value ? String(value).substring(0, 10) : null;
  }

  private uppercasePayload<T extends Record<string, unknown>>(payload: T): T {
    return Object.entries(payload).reduce((acc, [key, value]) => {
      if (key === 'emailInstitucional' || key === 'emailPersonal') {
        acc[key as keyof T] = typeof value === 'string' ? value.toLowerCase() as T[keyof T] : value as T[keyof T];
        return acc;
      }

      acc[key as keyof T] = typeof value === 'string' ? value.toUpperCase() as T[keyof T] : value as T[keyof T];
      return acc;
    }, {} as T);
  }

  private buildFichaPayload(): Record<string, unknown> {
    const raw = { ...this.uppercasePayload(this.fichaForm.getRawValue()) } as Record<string, unknown>;

    delete raw['numeroEmpleado'];
    delete raw['tipoPersonal'];
    delete raw['puesto'];
    delete raw['areaDepartamento'];
    delete raw['turno'];
    delete raw['tipoContrato'];
    delete raw['fechaIngreso'];
    delete raw['estatusLaboral'];

    return raw;
  }

  private resolveErrorMessage(error: any, fallback: string): string {
    if (typeof error?.error?.message === 'string') return error.error.message;
    if (typeof error?.error === 'string') return error.error;

    if (error?.status === 0) {
      return 'No fue posible conectar con el API. Revisa que GpsApi este iniciado y actualizado.';
    }

    if (error?.status === 404) {
      return 'El endpoint de documentos no esta disponible. Reinicia GpsApi para cargar la version nueva.';
    }

    if (error?.status === 413) {
      return 'El archivo es demasiado grande para enviarse desde la app.';
    }

    if (error?.status) {
      return `${fallback} Codigo HTTP ${error.status}.`;
    }

    return fallback;
  }

  private async presentToast(message: string, color: 'success' | 'warning' | 'danger' | 'medium'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2400,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
