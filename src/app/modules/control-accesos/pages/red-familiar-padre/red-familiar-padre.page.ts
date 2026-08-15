import { Component, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import QRCode from 'qrcode';
import { ActionSheetController, AlertController, ToastController } from '@ionic/angular';
import { AuthService } from '../../../../core/auth/auth.service';
import {
  AlumnoCompartido,
  AlumnoFamiliar,
  AplicarCodigoCompartirResponse,
  AutoFamiliar,
  CodigoCompartir,
  CodigoCompartirFamiliar,
  GenerarPaseInvitadoExternoRequest,
  GuardarAlumnoAutorizacionRequest,
  GuardarAutoFamiliarRequest,
  GuardarInvitadoExternoProvisionalRequest,
  GuardarMiembroFamiliarRequest,
  MiembroFamiliar,
  ModoCompartirAlumno,
  RedFamiliarCatalogo,
  RedFamiliarCatalogos,
  RedFamiliarRow,
} from '../../models/red-familiar.model';
import { RedFamiliarService } from '../../services/red-familiar.service';

type RedFamiliarTab = 'alumnos' | 'familiares' | 'autos';

@Component({
  selector: 'app-red-familiar-padre',
  templateUrl: './red-familiar-padre.page.html',
  styleUrls: ['./red-familiar-padre.page.scss'],
  standalone: false,
})
export class RedFamiliarPadrePage implements OnInit {
  activeTab: RedFamiliarTab = 'alumnos';
  loading = false;
  savingMiembro = false;
  savingAuto = false;
  savingAlumno = false;
  savingTag = false;
  savingExterno = false;
  generatingExternalPass = false;
  showMiembroForm = false;
  showAutoForm = false;
  showAlumnoForm = false;
  showExternoForm = false;
  showCodigoForm = false;
  externalPassMember: MiembroFamiliar | null = null;
  sharing = false;
  applyingCode = false;
  loadingCodigos = false;
  rows: RedFamiliarRow[] = [];
  catalogos: RedFamiliarCatalogos = {};
  codigosEmitidos: CodigoCompartir[] = [];
  codigoGenerado: CodigoCompartir | null = null;
  codigoConsultado: CodigoCompartir | null = null;
  codigoAplicado: AplicarCodigoCompartirResponse | null = null;
  codigoCapturado = '';
  selectedAlumnos = new Set<number>();
  editingMiembro: MiembroFamiliar | null = null;

  miembroForm: GuardarMiembroFamiliarRequest = this.createMiembroForm();
  autoForm: GuardarAutoFamiliarRequest = this.createAutoForm();
  alumnoForm: GuardarAlumnoAutorizacionRequest = this.createAlumnoForm();
  externoForm: GuardarInvitadoExternoProvisionalRequest = this.createExternoForm();
  externoPassForm = {
    fecha: this.defaultShareDate(),
    maxUsos: 1,
    comentarios: '',
  };
  codigoForm = {
    modo: 'PERMANENTE' as ModoCompartirAlumno,
    vigenciaFin: this.defaultShareDate(),
    maxUsos: 1,
    comentarios: '',
  };

  constructor(
    private readonly redFamiliarService: RedFamiliarService,
    private readonly toastController: ToastController,
    private readonly actionSheetController: ActionSheetController,
    private readonly alertController: AlertController,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  get idorg(): number {
    return this.authService.getCurrentUser()?.idorg ?? 0;
  }

  get idfamilia(): number | null {
    return this.rows.find((row) => !!row.idfamilia)?.idfamilia
      ?? this.familiares.find((miembro) => !!miembro.idfamilia)?.idfamilia
      ?? this.autos.find((auto) => !!auto.idfamilia)?.idfamilia
      ?? null;
  }

  get nombreFamilia(): string {
    return this.rows.find((row) => !!row.nombreFamilia)?.nombreFamilia || 'Red familiar';
  }

  get alumnos(): AlumnoFamiliar[] {
    const map = new Map<number, AlumnoFamiliar>();

    for (const row of this.rows) {
      if (!row.idmatricula || row.idmatricula <= 0 || !row.alumno) {
        continue;
      }

      const alumno: AlumnoFamiliar = {
        idalumnoautorizacion: row.idalumnoautorizacion ?? 0,
        idmatricula: row.idmatricula,
        matricula: row.matricula,
        curp: row.curp,
        gradoGrupo: row.gradoGrupo,
        alumno: row.alumno,
        tipoRelacion: row.tipoRelacion,
        tipoRelacionDescripcion: row.tipoRelacionDescripcion,
        puedeRecoger: row.puedeRecoger,
        puedeVerAcademico: row.puedeVerAcademico,
        requiereValidacionDocumento: row.requiereValidacionDocumento,
        fechaInicio: row.fechaInicio,
        fechaFin: row.fechaFin,
        compartidos: row.compartidos ?? [],
      };

      const existing = map.get(row.idmatricula);
      const isNucleo = (alumno.tipoRelacion ?? '').toUpperCase() === 'FAMILIA_NUCLEO';
      const existingIsNucleo = (existing?.tipoRelacion ?? '').toUpperCase() === 'FAMILIA_NUCLEO';

      if (!existing || (isNucleo && !existingIsNucleo)) {
        map.set(row.idmatricula, alumno);
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const rankA = this.esAlumnoNucleo(a) ? 0 : 1;
      const rankB = this.esAlumnoNucleo(b) ? 0 : 1;

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      return (a.idalumnoautorizacion || 0) - (b.idalumnoautorizacion || 0);
    });
  }

  get familiares(): MiembroFamiliar[] {
    const miembros = this.rows.flatMap((row) => row.miembros ?? []);
    const map = new Map<number, MiembroFamiliar>();

    for (const miembro of miembros) {
      if (!miembro.idfamiliamiembro || miembro.sitMiembroSilencioso || miembro.sitactivo === false) {
        continue;
      }

      map.set(miembro.idfamiliamiembro, miembro);
    }

    return Array.from(map.values()).sort((a, b) => a.familiar.localeCompare(b.familiar));
  }

  get autos(): AutoFamiliar[] {
    const autos = this.rows.flatMap((row) => row.autos ?? []);
    const map = new Map<number, AutoFamiliar>();

    for (const auto of autos) {
      if (!auto.idautofamiliar) {
        continue;
      }

      map.set(auto.idautofamiliar, auto);
    }

    return Array.from(map.values()).sort((a, b) => (a.placas ?? '').localeCompare(b.placas ?? ''));
  }

  get codigosEmitidosActivos(): CodigoCompartir[] {
    return this.codigosEmitidos.filter((codigo) => this.codigoEstaVigente(codigo));
  }

  get codigosEmitidosAlumnosActivos(): CodigoCompartir[] {
    return this.codigosEmitidosActivos.filter((codigo) => !this.codigoEsFamiliar(codigo));
  }

  get codigosEmitidosFamiliaresActivos(): CodigoCompartir[] {
    return this.codigosEmitidosActivos.filter((codigo) => this.codigoEsFamiliar(codigo));
  }

  get parentescos(): RedFamiliarCatalogo[] {
    return this.catalogos.parentescos ?? [];
  }

  get puedeGuardarMiembro(): boolean {
    return !!this.miembroForm.nombre.trim() && !!this.miembroForm.apellidos.trim() && !!this.idfamilia;
  }

  get puedeGuardarExterno(): boolean {
    return !!this.externoForm.nombre.trim() && !!this.externoForm.apellidos.trim() && !!this.idfamilia;
  }

  get puedeGenerarPaseExterno(): boolean {
    return !!this.idfamilia
      && !!this.externalPassMember?.idfamiliamiembro
      && !!this.externoPassForm.fecha
      && this.selectedAlumnos.size > 0;
  }

  get puedeGuardarAuto(): boolean {
    return !!this.autoForm.placas.trim() && !!this.idfamilia;
  }

  get masterMiembro(): MiembroFamiliar | null {
    return this.familiares.find((miembro) => miembro.esMaster) ?? this.familiares[0] ?? null;
  }

  get puedeGuardarAlumno(): boolean {
    return !!this.alumnoForm.alumnoReferencia?.trim() && !!this.idfamilia && !!this.masterMiembro?.idfamiliamiembro;
  }

  cargar(event?: { target?: { complete?: () => void } }): void {
    this.loading = true;

    if (!this.parentescos.length) {
      this.redFamiliarService.consultarCatalogos().subscribe({
        next: (catalogos) => {
          this.catalogos = catalogos;
        },
        error: () => undefined,
      });
    }

    this.recargarRed({
      complete: () => event?.target?.complete?.(),
      onError: async (error) => {
        await this.showToast(this.errorMessage(error, 'No fue posible consultar la red familiar.'), 'danger');
      },
    });
  }

  private recargarRed(options?: { complete?: () => void; onError?: (error: unknown) => void | Promise<void> }): void {
    this.redFamiliarService.consultarMiRed(this.idorg).subscribe({
      next: (rows) => {
        this.rows = rows;
        this.loading = false;
        this.cargarCodigosEmitidos();
        options?.complete?.();
      },
      error: async (error) => {
        this.loading = false;
        options?.complete?.();
        await options?.onError?.(error);
      },
    });
  }

  cambiarTab(tab: RedFamiliarTab): void {
    this.activeTab = tab;
    this.showMiembroForm = false;
    this.showAutoForm = false;
    this.showAlumnoForm = false;
    this.showCodigoForm = false;
    this.showExternoForm = false;
    this.externalPassMember = null;
  }

  toggleAlumnoForm(): void {
    this.showAlumnoForm = !this.showAlumnoForm;
    this.showMiembroForm = false;
    this.showAutoForm = false;
    this.showCodigoForm = false;
    if (this.showAlumnoForm) {
      this.alumnoForm = this.createAlumnoForm();
    }
  }

  toggleMiembroForm(): void {
    this.showMiembroForm = !this.showMiembroForm;
    this.showAutoForm = false;
    this.showAlumnoForm = false;
    this.showExternoForm = false;
    this.externalPassMember = null;
    if (this.showMiembroForm) {
      this.editingMiembro = null;
      this.miembroForm = this.createMiembroForm();
    }
  }

  toggleExternoForm(): void {
    this.showExternoForm = !this.showExternoForm;
    this.showMiembroForm = false;
    this.showAutoForm = false;
    this.showAlumnoForm = false;
    this.showCodigoForm = false;
    this.externalPassMember = null;
    if (this.showExternoForm) {
      this.externoForm = this.createExternoForm();
    }
  }

  editarMiembro(miembro: MiembroFamiliar): void {
    if (this.esMiembroExterno(miembro)) {
      void this.showToast('Los familiares externos solo pueden eliminarse de tu red.', 'warning');
      return;
    }

    this.editingMiembro = miembro;
    this.showMiembroForm = true;
    this.showAutoForm = false;
    this.showCodigoForm = false;
    this.miembroForm = {
      idorg: this.idorg,
      idusrbtMiembro: miembro.idusrbt ?? null,
      nombre: this.toUpper(miembro.nombre || this.firstName(miembro.familiar)),
      apellidos: this.toUpper(miembro.apellidos || this.lastName(miembro.familiar)),
      cel: miembro.cel ?? '',
      emailContacto: miembro.emailContacto ?? '',
      foto: miembro.foto ?? null,
      idparentesco: miembro.idparentesco ?? 10,
      puedeRecoger: miembro.puedeRecoger ?? true,
      puedeAdministrar: miembro.puedeAdministrar ?? false,
      sitMiembroSilencioso: miembro.sitMiembroSilencioso ?? false,
    };
  }

  toggleCodigoForm(): void {
    this.showCodigoForm = !this.showCodigoForm;
    this.showMiembroForm = false;
    this.showAutoForm = false;
    this.showAlumnoForm = false;
    this.codigoGenerado = null;
    this.codigoForm = {
      modo: 'PERMANENTE',
      vigenciaFin: this.defaultShareDate(),
      maxUsos: 1,
      comentarios: '',
    };
    this.selectedAlumnos = new Set(
      this.alumnos
        .filter((alumno) => this.puedeCompartirAlumno(alumno))
        .map((alumno) => alumno.idmatricula)
    );
  }

  toggleAutoForm(): void {
    this.showAutoForm = !this.showAutoForm;
    this.showMiembroForm = false;
    this.showAlumnoForm = false;
    this.showExternoForm = false;
    this.externalPassMember = null;
    if (this.showAutoForm) {
      this.autoForm = this.createAutoForm();
    }
  }

  guardarAlumno(): void {
    const idfamilia = this.idfamilia;
    const master = this.masterMiembro;
    const alumnoLookup = this.resolveAlumnoLookup(this.alumnoForm.alumnoReferencia);

    if (!idfamilia || !master?.idfamiliamiembro || !this.puedeGuardarAlumno) {
      return;
    }

    if (!alumnoLookup.matricula && !alumnoLookup.curp) {
      void this.showToast('Captura la matricula o CURP del alumno.', 'warning');
      return;
    }

    this.savingAlumno = true;
    this.redFamiliarService.crearAlumnoAutorizacion(idfamilia, {
      ...this.alumnoForm,
      idorg: this.idorg,
      idfamiliamiembro: master.idfamiliamiembro,
      idtiporelacionalumnousr: this.familiaNucleoRelacionId(),
      idparentesco: 10,
      matricula: alumnoLookup.matricula,
      curp: alumnoLookup.curp,
      puedeRecoger: true,
      puedeVerAcademico: false,
      requiereValidacionDocumento: false,
      estatus: 'ACTIVA',
      origen: 'APP_PADRE',
    }).subscribe({
      next: async () => {
        this.savingAlumno = false;
        this.showAlumnoForm = false;
        this.alumnoForm = this.createAlumnoForm();
        await this.showToast('Alumno agregado correctamente.', 'success');
        this.loading = true;
        this.recargarRed({
          onError: async (error) => {
            await this.showToast(this.errorMessage(error, 'No fue posible refrescar la red familiar.'), 'danger');
          },
        });
      },
      error: async (error) => {
        this.savingAlumno = false;
        await this.showToast(this.errorMessage(error, 'No fue posible agregar el alumno.'), 'danger');
      },
    });
  }

  guardarMiembro(): void {
    const idfamilia = this.idfamilia;

    if (!idfamilia || !this.puedeGuardarMiembro) {
      return;
    }

    this.savingMiembro = true;
    const request: GuardarMiembroFamiliarRequest = {
      ...this.miembroForm,
      nombre: this.toUpper(this.miembroForm.nombre),
      apellidos: this.toUpper(this.miembroForm.apellidos),
      cel: this.miembroForm.cel?.trim() || null,
      emailContacto: this.miembroForm.emailContacto?.trim() || null,
      idorg: this.idorg,
    };

    const request$ = this.editingMiembro
      ? this.redFamiliarService.actualizarMiembro(idfamilia, this.editingMiembro.idfamiliamiembro, request)
      : this.redFamiliarService.crearMiembro(idfamilia, request);
    const wasEditing = !!this.editingMiembro;

    request$.subscribe({
      next: async (miembro) => {
        this.savingMiembro = false;
        this.showMiembroForm = false;
        if (miembro) {
          this.upsertMiembroLocal(miembro);
        }
        this.editingMiembro = null;
        await this.showToast(wasEditing ? 'Familiar actualizado correctamente.' : 'Familiar guardado correctamente.', 'success');
      },
      error: async (error) => {
        this.savingMiembro = false;
        await this.showToast(this.errorMessage(error, 'No fue posible guardar el familiar.'), 'danger');
      },
    });
  }

  guardarExternoProvisional(): void {
    const idfamilia = this.idfamilia;

    if (!idfamilia || !this.puedeGuardarExterno) {
      return;
    }

    this.savingExterno = true;
    const request: GuardarInvitadoExternoProvisionalRequest = {
      ...this.externoForm,
      idorg: this.idorg,
      nombre: this.toUpper(this.externoForm.nombre),
      apellidos: this.toUpper(this.externoForm.apellidos),
      cel: this.externoForm.cel?.trim() || null,
      emailContacto: this.externoForm.emailContacto?.trim() || null,
      observaciones: this.externoForm.observaciones?.trim() || null,
      idparentesco: this.externoForm.idparentesco ?? 10,
    };

    this.redFamiliarService.crearInvitadoExternoProvisional(idfamilia, request).subscribe({
      next: async (miembro) => {
        this.savingExterno = false;
        this.showExternoForm = false;
        this.externoForm = this.createExternoForm();
        if (miembro) {
          this.upsertMiembroLocal(miembro);
        }
        await this.showToast('Persona externa provisional registrada.', 'success');
      },
      error: async (error) => {
        this.savingExterno = false;
        await this.showToast(this.errorMessage(error, 'No fue posible guardar la persona externa.'), 'danger');
      },
    });
  }

  async abrirPaseExterno(miembro: MiembroFamiliar): Promise<void> {
    if (!this.esInvitadoProvisional(miembro)) {
      await this.showToast('Solo los externos provisionales pueden generar este pase.', 'warning');
      return;
    }

    const paseActivo = this.paseActivoExterno(miembro);
    if (paseActivo) {
      await this.compartirCodigo(paseActivo);
      return;
    }

    this.externalPassMember = miembro;
    this.showMiembroForm = false;
    this.showExternoForm = false;
    this.showAutoForm = false;
    this.showAlumnoForm = false;
    this.showCodigoForm = false;
    this.codigoGenerado = null;
    setTimeout(() => document.querySelector('.pass-generator-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    void this.showToast('Selecciona alumnos y fecha para generar el pase QR.', 'success');
    this.externoPassForm = {
      fecha: '',
      maxUsos: 1,
      comentarios: '',
    };
    this.selectedAlumnos = new Set(
      this.alumnos
        .filter((alumno) => this.puedeCompartirAlumno(alumno))
        .map((alumno) => alumno.idmatricula)
    );
  }

  async cancelarPaseExterno(miembro: MiembroFamiliar): Promise<void> {
    const pase = this.paseActivoExterno(miembro);
    if (!pase) {
      await this.showToast('No hay pase QR activo para cancelar.', 'warning');
      return;
    }

    await this.cancelarCodigoEmitido(pase);
  }

  async cancelarCodigoEmitido(codigo: CodigoCompartir): Promise<void> {
    const idfamilia = this.idfamilia;
    if (!idfamilia) {
      await this.showToast('No se encontro la familia activa.', 'warning');
      return;
    }

    const confirmed = await this.confirmar(
      'Cancelar codigo',
      `El codigo ${codigo.codigo} dejara de ser valido para su lectura. Esta accion no elimina al familiar ni sus datos.`
    );

    if (!confirmed) {
      return;
    }

    this.redFamiliarService.cancelarCodigoCompartir(codigo.codigo, this.idorg, idfamilia).subscribe({
      next: async () => {
        this.codigosEmitidos = this.codigosEmitidos.filter((item) => item.codigo !== codigo.codigo && item.idcodigocompartir !== codigo.idcodigocompartir);
        this.codigoGenerado = this.codigoGenerado?.codigo === codigo.codigo ? null : this.codigoGenerado;
        this.externalPassMember = null;
        this.selectedAlumnos = new Set<number>();
        this.cargarCodigosEmitidos();
        await this.showToast('Codigo cancelado correctamente.', 'success');
      },
      error: async (error) => {
        await this.showToast(this.errorMessage(error, 'No fue posible cancelar el codigo.'), 'danger');
      },
    });
  }
  generarPaseExterno(): void {
    const idfamilia = this.idfamilia;
    const miembro = this.externalPassMember;
    const alumnos = Array.from(this.selectedAlumnos).map((idmatricula) => ({ idmatricula }));

    if (!idfamilia || !miembro?.idfamiliamiembro || !this.puedeGenerarPaseExterno) {
      return;
    }

    this.generatingExternalPass = true;
    const request: GenerarPaseInvitadoExternoRequest = {
      idorg: this.idorg,
      fecha: this.externoPassForm.fecha,
      vigenciaFin: this.endOfDayIso(this.externoPassForm.fecha),
      maxUsos: 1,
      comentarios: this.externoPassForm.comentarios?.trim() || `Pase externo provisional para ${miembro.familiar}.`,
      alumnos,
    };

    this.redFamiliarService.generarPaseInvitadoExterno(idfamilia, miembro.idfamiliamiembro, request).subscribe({
      next: async (codigo) => {
        this.generatingExternalPass = false;
        this.codigoGenerado = codigo;
        this.externalPassMember = null;
        this.cargarCodigosEmitidos();
        await this.showToast('Pase externo generado correctamente.', 'success');
        await this.compartirCodigo(codigo);
      },
      error: async (error) => {
        this.generatingExternalPass = false;
        await this.showToast(this.errorMessage(error, 'No fue posible generar el pase externo.'), 'danger');
      },
    });
  }

  guardarAuto(): void {
    const idfamilia = this.idfamilia;

    if (!idfamilia || !this.puedeGuardarAuto) {
      return;
    }

    this.savingAuto = true;
    const request: GuardarAutoFamiliarRequest = {
      ...this.autoForm,
      idorg: this.idorg,
      placas: this.toUpper(this.autoForm.placas),
      marca: this.toUpper(this.autoForm.marca),
      modelo: this.toUpper(this.autoForm.modelo),
      color: this.toUpper(this.autoForm.color),
      observaciones: this.autoForm.observaciones?.trim() || null,
    };

    this.redFamiliarService.crearAuto(idfamilia, request).subscribe({
      next: async (auto) => {
        this.savingAuto = false;
        this.showAutoForm = false;
        if (auto) {
          this.upsertAutoLocal(auto);
        }
        await this.showToast('Auto agregado correctamente.', 'success');
      },
      error: async (error) => {
        this.savingAuto = false;
        await this.showToast(this.errorMessage(error, 'No fue posible agregar el auto.'), 'danger');
      },
    });
  }

  async cambiarBloqueoMiembro(miembro: MiembroFamiliar): Promise<void> {
    if (!this.puedeBloquearTag(miembro) || !miembro.idtag) {
      await this.showToast('Este familiar no tiene TAG administrable desde tu red.', 'warning');
      return;
    }

    const bloquear = !miembro.sitbloqueo;
    const confirmed = await this.confirmar(
      bloquear ? 'Bloquear TAG' : 'Desbloquear TAG',
      bloquear
        ? `${miembro.familiar} seguira en tu red familiar, pero no podra recoger alumnos con su TAG.`
        : `${miembro.familiar} podra volver a usar su TAG segun la situacion asignada por el Colegio.`,
      bloquear ? 'Bloquear' : 'Desbloquear'
    );

    if (!confirmed) {
      return;
    }

    this.savingTag = true;
    this.redFamiliarService.actualizarBloqueoTag(miembro.idtag, this.idorg, bloquear, miembro.idsittag).subscribe({
      next: async () => {
        this.savingTag = false;
        this.upsertMiembroLocal({ ...miembro, sitbloqueo: bloquear });
        this.recargarRed();
        await this.showToast(bloquear ? 'TAG bloqueada.' : 'TAG desbloqueada.', 'success');
      },
      error: async (error) => {
        this.savingTag = false;
        await this.showToast(this.errorMessage(error, 'No fue posible actualizar el bloqueo de la TAG.'), 'danger');
      },
    });
  }
  async eliminarMiembro(miembro: MiembroFamiliar): Promise<void> {
    if (miembro.esMaster) {
      await this.showToast('El miembro master no puede eliminarse desde la app.', 'warning');
      return;
    }

    const mensaje = this.esMiembroExterno(miembro)
      ? `Se quitara a ${miembro.familiar} solo de tu red familiar. Su familia de origen se mantiene activa.`
      : `Se quitara a ${miembro.familiar} de la red familiar.`;
    const confirmed = await this.confirmar('Eliminar familiar', mensaje);

    if (!confirmed) {
      return;
    }

    this.redFamiliarService.cambiarEstadoMiembro(miembro.idfamiliamiembro, this.idorg, false).subscribe({
      next: async () => {
        this.removeMiembroLocal(miembro.idfamiliamiembro);
        this.removeCodigosDeMiembroLocal(miembro.idfamiliamiembro);
        await this.showToast('Familiar eliminado de la red familiar.', 'success');
      },
      error: async (error) => this.showToast(this.errorMessage(error, 'No fue posible eliminar el familiar.'), 'danger'),
    });
  }

  async eliminarAuto(auto: AutoFamiliar): Promise<void> {
    const confirmed = await this.confirmar('Eliminar auto', `Se quitara el auto ${auto.placas || ''} del parque vehicular.`);

    if (!confirmed) {
      return;
    }

    this.redFamiliarService.cambiarEstadoAuto(auto.idautofamiliar, this.idorg, false).subscribe({
      next: async () => {
        this.removeAutoLocal(auto.idautofamiliar);
        await this.showToast('Auto eliminado del parque vehicular.', 'success');
      },
      error: async (error) => this.showToast(this.errorMessage(error, 'No fue posible eliminar el auto.'), 'danger'),
    });
  }

  async eliminarAlumno(alumno: AlumnoFamiliar): Promise<void> {
    const confirmed = await this.confirmar('Eliminar alumno', `Se quitara a ${alumno.alumno} de la red familiar.`);

    if (!confirmed) {
      return;
    }

    this.redFamiliarService.cambiarEstadoAlumno(alumno.idalumnoautorizacion, this.idorg, false).subscribe({
      next: async () => {
        this.removeAlumnoLocal(alumno.idalumnoautorizacion);
        await this.showToast('Alumno eliminado de la red familiar.', 'success');
      },
      error: async (error) => this.showToast(this.errorMessage(error, 'No fue posible eliminar el alumno.'), 'danger'),
    });
  }

  async retirarAlumnoCompartido(alumno: AlumnoFamiliar): Promise<void> {
    const idfamilia = this.idfamilia;

    if (!idfamilia) {
      await this.showToast('No fue posible resolver la familia destino.', 'danger');
      return;
    }

    const confirmed = await this.confirmar(
      'Quitar de mi red',
      `Se retirara a ${alumno.alumno} de tu alcance o de la red que administras, segun tus permisos. La familia de origen no se modifica.`
    );

    if (!confirmed) {
      return;
    }

    this.redFamiliarService.retirarAlumnoCompartido(alumno.idmatricula, this.idorg, idfamilia).subscribe({
      next: async (resultado) => {
        this.loading = true;
        this.recargarRed({
          onError: async (error) => {
            await this.showToast(this.errorMessage(error, 'El retiro se guardo, pero no fue posible refrescar la red familiar.'), 'warning');
          },
        });
        const alcance = resultado.aplicaRedCompleta ? 'de la red familiar administrada' : 'de tu alcance familiar';
        await this.showToast(`Alumno retirado ${alcance}.`, 'success');
      },
      error: async (error) => this.showToast(
        this.errorMessage(error, 'No fue posible retirar el alumno compartido.'),
        'danger'
      ),
    });
  }

  alumnoSeleccionado(idmatricula: number): boolean {
    return this.selectedAlumnos.has(idmatricula);
  }

  toggleAlumnoCompartir(idmatricula: number, checked: boolean | null | undefined): void {
    if (checked === true) {
      this.selectedAlumnos.add(idmatricula);
      return;
    }

    this.selectedAlumnos.delete(idmatricula);
  }

  cambiarModoCompartir(): void {
    this.codigoGenerado = null;
  }

  puedeCompartirAlumno(alumno: AlumnoFamiliar): boolean {
    return this.esAlumnoNucleo(alumno);
  }

  esAlumnoNucleo(alumno: AlumnoFamiliar): boolean {
    return (alumno.tipoRelacion ?? '').toUpperCase() === 'FAMILIA_NUCLEO';
  }

  esAlumnoCompartidoExterno(alumno: AlumnoFamiliar): boolean {
    const tipoRelacion = (alumno.tipoRelacion ?? '').toUpperCase();
    return tipoRelacion === 'FAMILIAR_COMPARTIDO_PERMANENTE'
      || tipoRelacion === 'BRIGADA_EVENTO'
      || tipoRelacion === 'COMPARTIDO'
      || tipoRelacion === 'BRIGADA';
  }

  alumnoRelacionLabel(alumno: AlumnoFamiliar): string {
    const tipoRelacion = (alumno.tipoRelacion ?? '').toUpperCase();

    if (tipoRelacion === 'FAMILIAR_COMPARTIDO_PERMANENTE' || tipoRelacion === 'COMPARTIDO') {
      return 'Alumno compartido (PERMANENTE)';
    }

    if (tipoRelacion === 'BRIGADA_EVENTO' || tipoRelacion === 'BRIGADA') {
      return 'Alumno compartido (PROVISIONAL)';
    }

    if (tipoRelacion === 'FAMILIA_NUCLEO') {
      return 'Alumno de familia nucleo';
    }

    return alumno.tipoRelacionDescripcion || alumno.tipoRelacion || 'Relacion familiar';
  }

  alumnoRelacionColor(alumno: AlumnoFamiliar): 'primary' | 'tertiary' | 'medium' {
    if (this.esAlumnoNucleo(alumno)) {
      return 'primary';
    }

    if (this.esAlumnoCompartidoExterno(alumno)) {
      return 'tertiary';
    }

    return 'medium';
  }

  tieneCompartido(alumno: AlumnoFamiliar, tipo: 'PROVISIONAL' | 'PERMANENTE'): boolean {
    return (alumno.compartidos ?? []).some((compartido) => this.esTipoCompartido(compartido, tipo));
  }

  compartidosAlumno(alumno: AlumnoFamiliar): AlumnoCompartido[] {
    return alumno.compartidos ?? [];
  }

  compartidoLabel(compartido: AlumnoCompartido): string {
    return this.esTipoCompartido(compartido, 'PERMANENTE') ? 'Permanente' : 'Provisional';
  }

  async revocarCompartido(alumno: AlumnoFamiliar, compartido: AlumnoCompartido): Promise<void> {
    const destino = compartido.familiaDestino || compartido.familiarDestino || 'esta familia';
    const confirmed = await this.confirmar(
      'Revocar autorizacion',
      `Se quitara a ${alumno.alumno} de ${destino}.`
    );

    if (!confirmed) {
      return;
    }

    this.redFamiliarService.cambiarEstadoAlumno(compartido.idalumnoautorizacion, this.idorg, false).subscribe({
      next: async () => {
        this.removeAlumnoCompartidoLocal(compartido.idalumnoautorizacion);
        await this.showToast('Autorizacion revocada correctamente.', 'success');
      },
      error: async (error) => this.showToast(this.errorMessage(error, 'No fue posible revocar la autorizacion.'), 'danger'),
    });
  }

  generarCodigo(): void {
    const idfamilia = this.idfamilia;
    const alumnos = Array.from(this.selectedAlumnos).map((idmatricula) => ({ idmatricula }));

    if (!idfamilia) {
      void this.showToast('No fue posible resolver la familia para generar el codigo.', 'warning');
      return;
    }

    if (alumnos.length === 0) {
      void this.showToast('Selecciona al menos un alumno para compartir.', 'warning');
      return;
    }

    this.sharing = true;
    this.redFamiliarService.generarCodigoCompartir({
      idorg: this.idorg,
      idfamilia,
      tipoCompartir: this.codigoForm.modo === 'PERMANENTE' ? 'FAMILIAR_EXISTENTE' : 'BRIGADA',
      fecha: this.codigoForm.modo === 'PROVISIONAL' ? this.codigoForm.vigenciaFin : null,
      vigenciaFin: this.endOfDayIso(this.codigoForm.vigenciaFin),
      maxUsos: Math.max(1, Number(this.codigoForm.maxUsos) || 1),
      comentarios: this.codigoForm.comentarios?.trim() || null,
      alumnos,
    }).subscribe({
      next: async (codigo) => {
        this.sharing = false;
        this.codigoGenerado = codigo;
        this.cargarCodigosEmitidos();
        await this.showToast('Codigo generado correctamente.', 'success');
      },
      error: async (error) => {
        this.sharing = false;
        await this.showToast(this.errorMessage(error, 'No fue posible generar el codigo.'), 'danger');
      },
    });
  }

  async abrirCompartirFamiliar(miembro: MiembroFamiliar): Promise<void> {
    if (this.esMiembroExterno(miembro)) {
      await this.showToast('Solo puedes compartir familiares de tu nucleo familiar.', 'warning');
      return;
    }

    if (miembro.sitactivo === false) {
      await this.showToast('El familiar debe estar activo para compartirse.', 'warning');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Compartir familiar',
      message: `Generar codigo para que otra familia agregue a ${miembro.familiar}.`,
      inputs: [
        {
          name: 'fecha',
          type: 'date',
          value: this.defaultShareDate(),
        },
        {
          name: 'maxUsos',
          type: 'number',
          min: 1,
          value: 1,
          placeholder: 'Usos disponibles',
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Provisional',
          handler: (data) => {
            this.generarCodigoFamiliar(miembro, 'PROVISIONAL', data?.fecha, data?.maxUsos);
          },
        },
        {
          text: 'Permanente',
          handler: (data) => {
            this.generarCodigoFamiliar(miembro, 'PERMANENTE', data?.fecha, data?.maxUsos);
          },
        },
      ],
    });

    await alert.present();
  }

  private generarCodigoFamiliar(
    miembro: MiembroFamiliar,
    modo: ModoCompartirAlumno,
    fechaValue?: string,
    maxUsosValue?: number | string
  ): void {
    const idfamilia = this.idfamilia;
    const fecha = fechaValue || this.defaultShareDate();

    if (!idfamilia) {
      void this.showToast('No fue posible resolver la familia para generar el codigo.', 'warning');
      return;
    }

    this.sharing = true;
    this.codigoGenerado = null;

    this.redFamiliarService.generarCodigoCompartir({
      idorg: this.idorg,
      idfamilia,
      idfamiliamiembro: miembro.idfamiliamiembro,
      tipoCompartir: modo === 'PERMANENTE' ? 'FAMILIAR_EXISTENTE' : 'INVITADO_EXTERNO',
      fecha: modo === 'PROVISIONAL' ? fecha : null,
      vigenciaFin: this.endOfDayIso(fecha),
      maxUsos: Math.max(1, Number(maxUsosValue) || 1),
      comentarios: `Codigo para compartir familiar ${miembro.familiar}.`,
    }).subscribe({
      next: async (codigo) => {
        this.sharing = false;
        this.codigoGenerado = codigo;
        this.cargarCodigosEmitidos();
        await this.showToast('Codigo de familiar generado correctamente.', 'success');
        await this.compartirCodigo(codigo);
      },
      error: async (error) => {
        this.sharing = false;
        await this.showToast(this.errorMessage(error, 'No fue posible generar el codigo del familiar.'), 'danger');
      },
    });
  }

  consultarCodigo(): void {
    const codigo = this.codigoCapturado.trim();

    if (!codigo) {
      void this.showToast('Captura el codigo de autorizacion.', 'warning');
      return;
    }

    this.applyingCode = true;
    this.codigoConsultado = null;
    this.codigoAplicado = null;

    this.redFamiliarService.consultarCodigoCompartir(codigo, this.idorg).subscribe({
      next: (codigoInfo) => {
        this.applyingCode = false;
        this.codigoConsultado = codigoInfo;
      },
      error: async (error) => {
        this.applyingCode = false;
        await this.showToast(this.errorMessage(error, 'Codigo de autorizacion no valido.'), 'danger');
      },
    });
  }

  aplicarCodigo(): void {
    const codigo = this.codigoCapturado.trim();

    if (!codigo) {
      void this.showToast('Captura el codigo de autorizacion.', 'warning');
      return;
    }

    this.applyingCode = true;
    this.redFamiliarService.aplicarCodigoCompartir(codigo, {
      idorg: this.idorg,
      idfamilia: this.idfamilia,
    }).subscribe({
      next: async (resultado) => {
        this.applyingCode = false;
        this.codigoAplicado = resultado;
        this.codigoConsultado = null;
        await this.showToast('Codigo aplicado correctamente.', 'success');
        this.loading = true;
        this.recargarRed({
          onError: async (error) => {
            await this.showToast(this.errorMessage(error, 'No fue posible refrescar la red familiar.'), 'danger');
          },
        });
      },
      error: async (error) => {
        this.applyingCode = false;
        await this.showToast(this.errorMessage(error, 'No fue posible aplicar el codigo.'), 'danger');
      },
    });
  }

  async copiarCodigo(codigo: string): Promise<void> {
    try {
      await navigator.clipboard?.writeText(codigo);
      await this.showToast('Codigo copiado.', 'success');
    } catch {
      await this.showToast('No fue posible copiar el codigo.', 'warning');
    }
  }

  async compartirCodigo(codigo: CodigoCompartir): Promise<void> {
    const textoImagen = this.textoCompartirCodigo(codigo);
    const textoAdjunto = this.textoAdjuntoCompartirCodigo(codigo, textoImagen);
    const title = this.tituloCompartirCodigo(codigo);

    if (this.esPaseExterno(codigo)) {
      const sharedWithQr = await this.compartirCodigoConQr(codigo, title, textoImagen, textoAdjunto);
      if (sharedWithQr) {
        return;
      }
    }

    await this.compartirTextoCodigo(title, textoAdjunto);
  }

  cargarCodigosEmitidos(): void {
    const idfamilia = this.idfamilia;

    if (!idfamilia) {
      this.codigosEmitidos = [];
      return;
    }

    this.loadingCodigos = true;
    this.redFamiliarService.listarCodigosCompartir(this.idorg, idfamilia).subscribe({
      next: (codigos) => {
        this.codigosEmitidos = codigos;
        this.loadingCodigos = false;
      },
      error: async (error) => {
        this.loadingCodigos = false;
        await this.showToast(this.errorMessage(error, 'No fue posible consultar los codigos emitidos.'), 'danger');
      },
    });
  }

  codigoModoLabel(codigo: CodigoCompartir): string {
    if (this.esPaseExterno(codigo)) {
      return 'Pase externo';
    }

    const sujeto = this.codigoEsFamiliar(codigo) ? 'Familiar' : 'Alumnos';
    const modo = codigo.tipoCompartir === 'FAMILIAR_EXISTENTE' ? 'permanente' : 'provisional';
    return `${sujeto} ${modo}`;
  }

  codigoEstadoColor(codigo: CodigoCompartir): 'success' | 'warning' | 'medium' | 'danger' {
    const estado = (codigo.estatusOperativo || codigo.estatus || '').toUpperCase();

    if (estado === 'ACTIVO') {
      return 'success';
    }

    if (estado === 'USADO') {
      return 'warning';
    }

    if (estado === 'VENCIDO' || estado === 'CANCELADO') {
      return 'danger';
    }

    return 'medium';
  }

  alumnoReferencia(alumno: AlumnoFamiliar): string {
    const referencia = alumno.matricula || alumno.curp || 'Sin referencia escolar';
    return alumno.gradoGrupo ? `${referencia} | ${alumno.gradoGrupo}` : referencia;
  }

  codigoAplicadoMensaje(): string {
    if (!this.codigoAplicado) {
      return '';
    }

    if (this.codigoAplicado.familiarCompartido) {
      const familiar = this.codigoAplicado.familiarCompartido.familiar || 'Familiar';
      return `${familiar} agregado a tu red familiar.`;
    }

    return `${this.codigoAplicado.alumnosAgregados || 0} alumno(s) agregados a tu red.`;
  }

  familiarCodigo(codigo: CodigoCompartir): CodigoCompartirFamiliar | null {
    const familiarCompartido = codigo.familiarCompartido as CodigoCompartirFamiliar | CodigoCompartirFamiliar[] | null | undefined;
    return Array.isArray(familiarCompartido)
      ? familiarCompartido[0] ?? null
      : familiarCompartido ?? null;
  }

  private codigoEstaVigente(codigo: CodigoCompartir): boolean {
    const estado = (codigo.estatusOperativo || codigo.estatus || '').toUpperCase();

    if (estado === 'VENCIDO' || estado === 'CANCELADO' || estado === 'INACTIVO' || estado === 'USADO') {
      return false;
    }

    if ((codigo.maxUsos ?? 0) > 0 && (codigo.usosRealizados ?? 0) >= (codigo.maxUsos ?? 0)) {
      return false;
    }

    if (codigo.vigenciaFin) {
      const vigencia = new Date(codigo.vigenciaFin);
      if (!Number.isNaN(vigencia.getTime()) && vigencia.getTime() <= Date.now()) {
        return false;
      }
    }

    return true;
  }

  private async compartirCodigoConQr(codigo: CodigoCompartir, title: string, textoImagen: string, textoAdjunto: string): Promise<boolean> {
    try {
      const qrDataUrl = await this.generarQrPaseDataUrl(codigo, textoImagen);

      if (Capacitor.isNativePlatform()) {
        const fileUri = await this.guardarQrTemporal(codigo.codigo, qrDataUrl);
        if (!fileUri) {
          return false;
        }

        await Share.share({
          title,
          text: textoAdjunto,
          files: [fileUri],
          dialogTitle: 'Compartir pase Seclife',
        });
        return true;
      }

      if (navigator.share) {
        const qrFile = await this.crearQrFile(codigo.codigo, qrDataUrl);
        const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };

        if (!nav.canShare || nav.canShare({ files: [qrFile] })) {
          await navigator.share({
            title,
            text: textoAdjunto,
            files: [qrFile],
          });
          return true;
        }
      }
    } catch (error) {
      if (this.shareWasCanceled(error)) {
        return true;
      }
      await this.showToast('No fue posible compartir la imagen QR, se intentara compartir el texto.', 'warning');
    }

    return false;
  }

  private async compartirTextoCodigo(title: string, texto: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title,
          text: texto,
          dialogTitle: 'Compartir codigo Seclife',
        });
        return;
      } catch (error) {
        if (this.shareWasCanceled(error)) {
          return;
        }
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: texto,
        });
        return;
      } catch {
        // El usuario pudo cancelar la hoja nativa de compartir.
      }
    }

    try {
      await navigator.clipboard?.writeText(texto);
      await this.showToast('Mensaje copiado para compartir.', 'success');
    } catch {
      await this.showToast('No fue posible abrir compartir ni copiar el mensaje.', 'warning');
    }
  }

  private async generarQrDataUrl(codigo: string): Promise<string> {
    return QRCode.toDataURL(codigo, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    });
  }

  private async generarQrPaseDataUrl(codigo: CodigoCompartir, texto: string): Promise<string> {
    const qrDataUrl = await this.generarQrDataUrl(codigo.codigo);
    const qrImage = await this.loadImage(qrDataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1320;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return qrDataUrl;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 42px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PASE PROVISIONAL SECLIFE', canvas.width / 2, 88);

    ctx.fillStyle = '#475569';
    ctx.font = '24px Arial';
    ctx.fillText('Presentar identificacion oficial en el Colegio', canvas.width / 2, 126);

    ctx.drawImage(qrImage, 206, 168, 512, 512);

    ctx.fillStyle = '#111827';
    ctx.font = 'bold 54px Arial';
    ctx.fillText(codigo.codigo, canvas.width / 2, 750);

    const fecha = codigo.alumnos?.[0]?.fechaServicio
      ? this.formatDateOnly(codigo.alumnos[0].fechaServicio)
      : this.formatDateOnly(codigo.vigenciaFin);
    ctx.fillStyle = '#2563eb';
    ctx.font = 'bold 30px Arial';
    ctx.fillText(`Fecha: ${fecha}`, canvas.width / 2, 808);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Alumnos autorizados:', 70, 870);

    ctx.fillStyle = '#334155';
    ctx.font = '24px Arial';
    const alumnos = this.alumnosCodigoTexto(codigo);
    let y = 910;
    for (const alumno of alumnos.slice(0, 6)) {
      const linesAlumno = this.wrapCanvasText(ctx, `- ${alumno}`, 760);
      for (const line of linesAlumno.slice(0, 2)) {
        ctx.fillText(line, 88, y);
        y += 32;
      }
    }

    if (alumnos.length > 6) {
      ctx.fillText(`- ${alumnos.length - 6} alumno(s) mas`, 88, y);
      y += 32;
    }

    y += 18;
    ctx.font = '25px Arial';
    const lines = this.wrapCanvasText(ctx, texto, 760);
    for (const line of lines.slice(0, 5)) {
      ctx.fillText(line, 70, y);
      y += 36;
    }

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(34, 34, canvas.width - 68, canvas.height - 68);

    return canvas.toDataURL('image/png');
  }

  private alumnosCodigoTexto(codigo: CodigoCompartir): string[] {
    return (codigo.alumnos ?? [])
      .map((alumno) => (alumno.alumno || `Matricula ${alumno.idmatricula}`).trim())
      .filter(Boolean);
  }

  private loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No fue posible generar la imagen QR.'));
      image.src = dataUrl;
    });
  }

  private wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }

    if (line) {
      lines.push(line);
    }

    return lines;
  }

  private async guardarQrTemporal(codigo: string, dataUrl: string): Promise<string | null> {
    const data = dataUrl.split(',')[1] ?? dataUrl;
    const fileName = `seclife-pase-${codigo}.png`;
    const result = await Filesystem.writeFile({
      path: fileName,
      data,
      directory: Directory.Cache,
    });

    return result.uri ?? null;
  }

  private async crearQrFile(codigo: string, dataUrl: string): Promise<File> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], `seclife-pase-${codigo}.png`, { type: 'image/png' });
  }

  private tituloCompartirCodigo(codigo: CodigoCompartir): string {
    if (this.esPaseExterno(codigo)) {
      return 'Seclife - Pase provisional QR';
    }

    return this.codigoEsFamiliar(codigo)
      ? 'Seclife - Codigo para compartir familiar'
      : 'Seclife - Codigo para compartir alumnos';
  }

  private esPaseExterno(codigo: CodigoCompartir): boolean {
    if ((codigo.tipoCompartir ?? '').toUpperCase() !== 'INVITADO_EXTERNO') {
      return false;
    }

    const familiar = this.familiarCodigo(codigo);
    return !!familiar?.idinvitadoexterno
      || familiar?.requiereValidacionDocumento === true
      || (codigo.alumnos ?? []).some((alumno) => !!alumno.fechaServicio);
  }
  private textoCompartirCodigo(codigo: CodigoCompartir): string {
    const familia = this.nombreFamilia || 'RED FAMILIAR';

    if (this.esPaseExterno(codigo)) {
      const familiar = this.familiarCodigo(codigo)?.familiar || 'persona externa';
      const fecha = codigo.alumnos?.[0]?.fechaServicio
        ? this.formatDateOnly(codigo.alumnos[0].fechaServicio)
        : this.formatDateOnly(codigo.vigenciaFin);
      return `Pase provisional Seclife para ${familiar}. Familia "${familia}". Codigo: ${codigo.codigo}. Fecha: ${fecha}. Presentar identificacion oficial en el Colegio.`;
    }

    if (this.codigoEsFamiliar(codigo)) {
      const familiar = this.familiarCodigo(codigo)?.familiar || 'miembro familiar';
      return `Mensaje de Seclife para compartir al familiar "${familiar}" de la Familia "${familia}" a traves del codigo: ${codigo.codigo}, favor de agregar en tu aplicacion en la seccion de Codigo recibido.`;
    }

    return `Mensaje de Seclife para compartir alumnos de la Familia "${familia}" a traves del codigo: ${codigo.codigo}, favor de agregar en tu aplicacion en la seccion de Codigo recibido.`;
  }


  private textoAdjuntoCompartirCodigo(codigo: CodigoCompartir, textoFallback: string): string {
    if (this.esPaseExterno(codigo) && codigo.ubicacionMapsUrl) {
      return codigo.ubicacionMapsUrl;
    }

    return textoFallback;
  }

  private codigoEsFamiliar(codigo: CodigoCompartir): boolean {
    return !!codigo.familiarCompartido;
  }

  private shareWasCanceled(error: unknown): boolean {
    const message = String((error as { message?: unknown })?.message ?? error ?? '').toLowerCase();
    return message.includes('cancel');
  }

  private esTipoCompartido(compartido: AlumnoCompartido, tipo: 'PROVISIONAL' | 'PERMANENTE'): boolean {
    const tipoRelacion = (compartido.tipoRelacion ?? '').toUpperCase();
    const origen = (compartido.origen ?? '').toUpperCase();

    if (tipo === 'PERMANENTE') {
      return tipoRelacion === 'COMPARTIDO'
        || tipoRelacion === 'FAMILIAR_COMPARTIDO_PERMANENTE'
        || origen === 'COMPARTIDO';
    }

    return tipoRelacion === 'BRIGADA'
      || tipoRelacion === 'BRIGADA_EVENTO'
      || origen === 'BRIGADA';
  }

  async seleccionarOrigenFoto(
    miembro: MiembroFamiliar,
    galeriaInput: HTMLInputElement,
    camaraInput: HTMLInputElement
  ): Promise<void> {
    if (this.esMiembroExterno(miembro)) {
      await this.showToast('La fotografia de un familiar externo solo la administra su familia de origen.', 'warning');
      return;
    }

    const actionSheet = await this.actionSheetController.create({
      header: 'Fotografia del familiar',
      buttons: [
        {
          text: 'Tomar foto',
          icon: 'camera-outline',
          handler: () => {
            camaraInput.click();
          },
        },
        {
          text: 'Elegir de galeria',
          icon: 'images-outline',
          handler: () => {
            galeriaInput.click();
          },
        },
        {
          text: 'Cancelar',
          icon: 'close-outline',
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }

  async cargarFotoMiembro(miembro: MiembroFamiliar, event: Event): Promise<void> {
    if (this.esMiembroExterno(miembro)) {
      await this.showToast('La fotografia de un familiar externo solo la administra su familia de origen.', 'warning');
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      await this.showToast('Selecciona un archivo de imagen.', 'warning');
      return;
    }

    const idfamilia = miembro.idfamilia ?? this.idfamilia;

    if (!idfamilia) {
      await this.showToast('No fue posible resolver la familia.', 'danger');
      return;
    }

    const foto = await this.fileToBase64(file);

    this.redFamiliarService.actualizarMiembro(idfamilia, miembro.idfamiliamiembro, {
      idorg: this.idorg,
      idusrbtMiembro: miembro.idusrbt ?? null,
      nombre: this.toUpper(miembro.nombre || this.firstName(miembro.familiar)),
      apellidos: this.toUpper(miembro.apellidos || this.lastName(miembro.familiar)),
      foto: null,
      cel: miembro.cel ?? null,
      emailContacto: miembro.emailContacto ?? null,
      idparentesco: miembro.idparentesco ?? 10,
      puedeRecoger: miembro.puedeRecoger ?? true,
      puedeAdministrar: miembro.puedeAdministrar ?? false,
      sitMiembroSilencioso: miembro.sitMiembroSilencioso ?? false,
    }).subscribe({
      next: async (miembroActualizado) => {
        const actualizado = miembroActualizado ?? { ...miembro };
        const idusrbtMiembro = actualizado.idusrbt ?? miembro.idusrbt ?? null;

        if (!idusrbtMiembro) {
          this.upsertMiembroLocal(actualizado);
          await this.showToast('No fue posible resolver el usuario del familiar para guardar la fotografia oficial.', 'warning');
          return;
        }

        this.redFamiliarService.guardarFotoCredencial({
          idorg: this.idorg,
          idperfil: 4,
          idusrbtMiembro,
          fotoBase64: foto,
          fotoContentType: 'image/jpeg',
          origen: 'APPSECLIFE',
          procesamientoEstado: 'SIN_PROCESAR',
          procesamientoMetodo: 'RED_FAMILIAR_APP',
          sitvalidada: true,
        }).subscribe({
          next: async (fotoCredencial) => {
            this.upsertMiembroLocal({ ...actualizado, foto: fotoCredencial?.fotoUrl ?? foto });
            await this.showToast('Fotografia actualizada.', 'success');
          },
          error: async (error) => this.showToast(this.errorMessage(error, 'No fue posible guardar la fotografia oficial.'), 'danger'),
        });
      },
      error: async (error) => this.showToast(this.errorMessage(error, 'No fue posible actualizar la fotografia.'), 'danger'),
    });
  }

  fotoSrc(foto?: string | null): string | null {
    if (!foto) {
      return null;
    }

    return foto.startsWith('data:') ? foto : `data:image/jpeg;base64,${foto}`;
  }

  tagEstadoLabel(miembro: MiembroFamiliar): string | null {
    if (this.esInvitadoProvisional(miembro) || !miembro.idtag) {
      return null;
    }

    if (miembro.sitbloqueo) {
      return 'TAG bloqueada';
    }

    switch (miembro.idsittag) {
      case 1:
        return 'TAG asignada';
      case 2:
        return 'TAG en tramite';
      case 3:
        return 'TAG activada';
      default:
        return 'TAG sin estado';
    }
  }

  tagEstadoColor(miembro: MiembroFamiliar): 'success' | 'warning' | 'danger' | 'medium' {
    if (miembro.sitbloqueo) {
      return 'danger';
    }

    if (miembro.idsittag === 2 || miembro.idsittag === 3) {
      return 'success';
    }

    if (miembro.idsittag === 1) {
      return 'warning';
    }

    return 'medium';
  }

  puedeBloquearTag(miembro: MiembroFamiliar): boolean {
    return !!miembro.idtag
      && !this.esMiembroExterno(miembro)
      && !this.esInvitadoProvisional(miembro);
  }

  bloqueoTagLabel(miembro: MiembroFamiliar): string {
    return miembro.sitbloqueo ? 'Desbloquear' : 'Bloquear';
  }

  bloqueoTagIcon(miembro: MiembroFamiliar): string {
    return miembro.sitbloqueo ? 'lock-open-outline' : 'lock-closed-outline';
  }
  codigoTipo(miembro: MiembroFamiliar): string {
    if (this.esInvitadoProvisional(miembro)) {
      return 'PASE QR';
    }

    const codigo = miembro.codigo?.trim() ?? '';
    return /^\d{10}$/.test(codigo) ? 'NFC' : 'QR';
  }

  miembroEntregaColor(miembro: MiembroFamiliar): 'success' | 'medium' | 'warning' {
    if (this.esInvitadoProvisional(miembro)) {
      return this.paseActivoExterno(miembro) ? 'success' : 'warning';
    }

    return miembro.puedeRecoger ? 'success' : 'medium';
  }

  miembroEntregaLabel(miembro: MiembroFamiliar): string {
    if (this.esInvitadoProvisional(miembro)) {
      return this.paseActivoExterno(miembro) ? 'Puede recoger' : 'Requiere pase';
    }

    return miembro.puedeRecoger ? 'Puede recoger' : 'Sin entrega';
  }

  miembroPaseFechaLabel(miembro: MiembroFamiliar): string | null {
    const pase = this.paseActivoExterno(miembro);
    const fecha = pase?.alumnos?.[0]?.fechaServicio ?? pase?.vigenciaFin;
    return fecha ? `Fecha de pase: ${this.formatDateOnly(fecha)}` : null;
  }

  miembroTienePaseActivo(miembro: MiembroFamiliar): boolean {
    return !!this.paseActivoExterno(miembro);
  }

  miembroPaseAccionLabel(miembro: MiembroFamiliar): string {
    return this.miembroTienePaseActivo(miembro) ? 'Ver QR' : 'Pase QR';
  }

  miembroPaseAccionIcon(miembro: MiembroFamiliar): string {
    return this.paseActivoExterno(miembro) ? 'share-social-outline' : 'qr-code-outline';
  }

  private paseActivoExterno(miembro: MiembroFamiliar): CodigoCompartir | null {
    if (!this.esInvitadoProvisional(miembro)) {
      return null;
    }

    return this.codigosEmitidosFamiliaresActivos.find((codigo) => {
      const familiar = this.familiarCodigo(codigo);
      return this.esPaseExterno(codigo) && familiar?.idfamiliamiembro === miembro.idfamiliamiembro;
    }) ?? null;
  }
  esMiembroExterno(miembro: MiembroFamiliar): boolean {
    return miembro.esExterno === true;
  }

  esInvitadoProvisional(miembro: MiembroFamiliar): boolean {
    return !!miembro.idinvitadoexterno && !miembro.idusrbt;
  }

  private upsertMiembroLocal(miembro: MiembroFamiliar): void {
    if (!miembro.idfamiliamiembro) {
      return;
    }

    this.rows = this.rows.map((row) => {
      const miembros = [...(row.miembros ?? [])];
      const index = miembros.findIndex((item) => item.idfamiliamiembro === miembro.idfamiliamiembro);

      if (index >= 0) {
        miembros[index] = { ...miembros[index], ...miembro };
      } else {
        miembros.push(miembro);
      }

      return { ...row, miembros };
    });
  }

  private removeMiembroLocal(idfamiliamiembro: number): void {
    this.rows = this.rows.map((row) => ({
      ...row,
      miembros: (row.miembros ?? []).filter((miembro) => miembro.idfamiliamiembro !== idfamiliamiembro),
    }));
  }

  private upsertAutoLocal(auto: AutoFamiliar): void {
    if (!auto.idautofamiliar) {
      return;
    }

    this.rows = this.rows.map((row) => {
      const autos = [...(row.autos ?? [])];
      const index = autos.findIndex((item) => item.idautofamiliar === auto.idautofamiliar);

      if (index >= 0) {
        autos[index] = { ...autos[index], ...auto };
      } else {
        autos.push(auto);
      }

      return { ...row, autos };
    });
  }

  private removeAutoLocal(idautofamiliar: number): void {
    this.rows = this.rows.map((row) => ({
      ...row,
      autos: (row.autos ?? []).filter((auto) => auto.idautofamiliar !== idautofamiliar),
    }));
  }

  private removeAlumnoLocal(idalumnoautorizacion: number): void {
    this.rows = this.rows.filter((row) => row.idalumnoautorizacion !== idalumnoautorizacion).map((row) => ({
      ...row,
      compartidos: (row.compartidos ?? []).filter((compartido) => compartido.idalumnoautorizacion !== idalumnoautorizacion),
    }));
  }

  private removeAlumnoCompartidoLocal(idalumnoautorizacion: number): void {
    this.rows = this.rows.map((row) => ({
      ...row,
      compartidos: (row.compartidos ?? []).filter((compartido) => compartido.idalumnoautorizacion !== idalumnoautorizacion),
    }));
  }

  private removeCodigosDeMiembroLocal(idfamiliamiembro: number): void {
    this.codigosEmitidos = this.codigosEmitidos.filter((codigo) => {
      const familiar = this.familiarCodigo(codigo);
      return familiar?.idfamiliamiembro !== idfamiliamiembro;
    });
  }

  private createMiembroForm(): GuardarMiembroFamiliarRequest {
    return {
      idorg: this.idorg,
      nombre: '',
      apellidos: '',
      cel: '',
      emailContacto: '',
      idparentesco: 10,
      puedeRecoger: true,
      puedeAdministrar: false,
      sitMiembroSilencioso: false,
    };
  }

  private createExternoForm(): GuardarInvitadoExternoProvisionalRequest {
    return {
      idorg: this.idorg,
      nombre: '',
      apellidos: '',
      cel: '',
      emailContacto: '',
      idparentesco: 10,
      observaciones: '',
    };
  }

  private createAutoForm(): GuardarAutoFamiliarRequest {
    return {
      idorg: this.idorg,
      placas: '',
      marca: '',
      modelo: '',
      color: '',
      observaciones: '',
    };
  }

  private createAlumnoForm(): GuardarAlumnoAutorizacionRequest {
    return {
      idorg: this.idorg,
      idmatricula: null,
      matricula: null,
      curp: null,
      alumnoReferencia: null,
      idfamiliamiembro: 0,
      idtiporelacionalumnousr: 0,
      idparentesco: 10,
      fechaInicio: null,
      fechaFin: null,
      puedeRecoger: true,
      puedeVerAcademico: false,
      requiereValidacionDocumento: false,
      estatus: 'ACTIVA',
      origen: 'APP_PADRE',
      comentarios: '',
    };
  }

  private toUpper(value?: string | null): string {
    return (value ?? '').trim().toUpperCase();
  }

  toUpperForm(target: any, key: string): void {
    const value = target[key];
    if (typeof value === 'string') {
      target[key] = value.toUpperCase();
    }
  }

  private defaultShareDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  }

  private endOfDayIso(dateValue: string): string {
    return dateValue ? `${dateValue}T23:59:59` : new Date().toISOString();
  }

  private formatDateOnly(value?: string | null): string {
    if (!value) {
      return 'fecha programada';
    }

    const raw = value.slice(0, 10);
    const parts = raw.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
  }

  private familiaNucleoRelacionId(): number {
    const relacion = (this.catalogos.tiposRelacion ?? []).find((tipo) => {
      const text = `${tipo.descripcion ?? ''} ${tipo.nombre ?? ''}`.toUpperCase();
      return text.includes('FAMILIA_NUCLEO') || text.includes('FAMILIA NUCLEO');
    });

    return Number(relacion?.idtiporelacionalumnousr) || 1;
  }

  private resolveAlumnoLookup(value?: string | null): { matricula: string | null; curp: string | null } {
    const reference = (value ?? '').trim();

    if (!reference) {
      return { matricula: null, curp: null };
    }

    const normalized = reference.toUpperCase();
    const looksLikeCurp = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(normalized);

    return looksLikeCurp
      ? { matricula: null, curp: normalized }
      : { matricula: reference, curp: null };
  }

  private errorMessage(error: any, fallback: string): string {
    return error?.error?.message || error?.error?.Message || error?.message || fallback;
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = String(reader.result || '');
        resolve(value.includes(',') ? value.split(',')[1] : value);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private firstName(fullName?: string | null): string {
    return (fullName ?? '').trim().split(/\s+/)[0] ?? '';
  }

  private lastName(fullName?: string | null): string {
    const parts = (fullName ?? '').trim().split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  }

  private async confirmar(header: string, message: string, confirmText = 'Eliminar'): Promise<boolean> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: confirmText, role: 'confirm', cssClass: confirmText === 'Eliminar' || confirmText === 'Bloquear' ? 'danger-button' : undefined },
      ],
    });

    await alert.present();
    const result = await alert.onDidDismiss();
    return result.role === 'confirm';
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2300,
      color,
      position: 'top',
    });

    await toast.present();
  }
}
