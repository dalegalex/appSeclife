import { ChangeDetectorRef, Component, NgZone, OnDestroy } from '@angular/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  CapacitorBarcodeScannerCameraDirection,
  CapacitorBarcodeScannerScanOrientation,
  CapacitorBarcodeScannerTypeHint,
} from '@capacitor/barcode-scanner';
import { CapacitorNfc, NfcEvent, NdefRecord, PluginListenerHandle } from '@capgo/capacitor-nfc';
import { AlertController, ToastController } from '@ionic/angular';
import { Subscription, firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { scanQrCode } from '../../../../core/qr-scanner';
import {
  IdentidadLecturaAsistida,
  LecturaAsistidaAlumno,
  LecturaAsistidaAuto,
  LecturaAsistidaResponse,
  SentidoAcceso,
  TipoBusquedaIdentidad,
  UnidadAdministrativaLectura,
} from '../../models/lectura-asistida.model';
import { LecturaAsistidaService } from '../../services/lectura-asistida.service';
import { CarruselDispositivo, CarruselSesion } from '../../models/carrusel.model';
import { CarruselService } from '../../services/carrusel.service';

type TipoEntregaSalida = 'AUTO' | 'OTRO_AUTO' | 'PEATONAL';

@Component({
  selector: 'app-lectura-asistida',
  templateUrl: './lectura-asistida.page.html',
  styleUrls: ['./lectura-asistida.page.scss'],
  standalone: false,
})
export class LecturaAsistidaPage implements OnDestroy {
  codigo = '';
  sentido: SentidoAcceso = 'ENTRADA';
  mostrarFoto = true;
  modoAviso = false;
  nfcActivo = false;
  qrActivo = false;
  loading = false;
  saving = false;
  lectura: LecturaAsistidaResponse | null = null;
  seleccion = new Set<number>();
  tipoEntrega: TipoEntregaSalida | null = null;
  idautofamiliarSeleccionado: number | null = null;
  unidadesAdministrativas: UnidadAdministrativaLectura[] = [];
  unidadesSeleccionadas = new Set<number>();
  cargandoUnidades = false;
  carruselesActivos: CarruselSesion[] = [];
  idcarruselsesionSeleccionada: number | null = null;
  puntoLecturaCarrusel: CarruselDispositivo | null = null;
  cargandoCarruseles = false;
  modalBusquedaAbierto = false;
  tipoBusquedaIdentidad: TipoBusquedaIdentidad = 'FAMILIAR';
  textoBusquedaIdentidad = '';
  resultadosIdentidad: IdentidadLecturaAsistida[] = [];
  buscandoIdentidad = false;
  identificacionManual = false;
  identidadManualSeleccionada: IdentidadLecturaAsistida | null = null;
  private nfcListener: PluginListenerHandle | null = null;
  private nfcProcesando = false;
  private paginaActiva = false;
  private nfcHabilitadoPorUsuario = true;
  private nfcRecoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private ultimoCodigoNfc: string | null = null;
  private ultimaLecturaNfcAt = 0;
  private audioContext: AudioContext | null = null;
  private subscriptions = new Subscription();

  constructor(
    private readonly lecturaService: LecturaAsistidaService,
    private readonly carruselService: CarruselService,
    private readonly toastController: ToastController,
    private readonly alertController: AlertController,
    private readonly authService: AuthService,
    private readonly zone: NgZone,
    private readonly cdRef: ChangeDetectorRef
  ) {
    this.subscriptions.add(this.carruselService.cierre$.subscribe(() => {
      if (this.modoAviso) {
        void this.cargarCarruselesActivos(false);
      }
    }));
  }

  get idorg(): number {
    return this.authService.getCurrentUser()?.idorg ?? 0;
  }

  async ionViewWillEnter(): Promise<void> {
    this.paginaActiva = true;
    this.nfcHabilitadoPorUsuario = true;
    this.limpiarRecuperacionNfc();
    await this.activarNfc(true);
  }

  ionViewDidLeave(): void {
    this.paginaActiva = false;
    this.limpiarRecuperacionNfc();
    void this.detenerLecturaNfc();
  }

  get unidadesFiltroActivo(): boolean {
    return this.unidadesAdministrativas.length > 0
      && this.unidadesSeleccionadas.size > 0
      && this.unidadesSeleccionadas.size < this.unidadesAdministrativas.length;
  }

  get unidadesFiltroLabel(): string {
    if (!this.unidadesAdministrativas.length || this.unidadesSeleccionadas.size === this.unidadesAdministrativas.length) {
      return 'Todas las unidades';
    }

    if (this.unidadesSeleccionadas.size === 0) {
      return 'Sin unidades seleccionadas';
    }

    return `${this.unidadesSeleccionadas.size} unidad(es)`;
  }

  get alumnos(): LecturaAsistidaAlumno[] {
    return [...(this.lectura?.alumnos ?? [])].sort((a, b) => {
      const aNucleo = this.esAlumnoNucleo(a) ? 0 : 1;
      const bNucleo = this.esAlumnoNucleo(b) ? 0 : 1;
      if (aNucleo !== bNucleo) return aNucleo - bNucleo;
      return (a.alumno ?? '').localeCompare(b.alumno ?? '', 'es');
    });
  }

  get autos(): LecturaAsistidaAuto[] {
    return (this.lectura?.autos ?? []).filter((auto) => auto.sitactivo !== false);
  }
  get carruselSeleccionado(): CarruselSesion | null {
    return this.carruselesActivos.find((sesion) => sesion.idcarruselsesion === this.idcarruselsesionSeleccionada) ?? null;
  }

  get avisoCarruselValido(): boolean {
    return !this.modoAviso || !!this.idcarruselsesionSeleccionada;
  }

  get puedeIdentificarManualmente(): boolean {
    return this.authService.canExecuteAppRoute('/control-accesos/lectura-asistida');
  }


  get requiereEntregaSalida(): boolean {
    return this.sentido === 'SALIDA' && !!this.lectura && this.lectura.tipoLectura !== 'ALUMNO';
  }

  get entregaSalidaValida(): boolean {
    if (!this.requiereEntregaSalida) {
      return true;
    }

    if (this.tipoEntrega === 'AUTO') {
      return !!this.idautofamiliarSeleccionado;
    }

    return this.tipoEntrega === 'OTRO_AUTO' || this.tipoEntrega === 'PEATONAL';
  }

  get puedeRegistrar(): boolean {
    return this.entregaSalidaValida
      && this.avisoCarruselValido
      && this.alumnos.some((alumno) => this.seleccion.has(alumno.idmatricula) && this.alumnoDisponible(alumno));
  }
  get muestraLeyendaFamilias(): boolean {
    return this.lectura?.tipoLectura === 'FAMILIAR'
      && this.alumnos.some((alumno) => !this.esAlumnoNucleo(alumno));
  }

  esAlumnoNucleo(alumno: LecturaAsistidaAlumno): boolean {
    const tipoRelacion = (alumno.tipoRelacion ?? '').trim().toUpperCase();
    if (tipoRelacion) {
      return tipoRelacion === 'FAMILIA_NUCLEO';
    }

    const familiaLectura = this.lectura?.familiar?.idfamilia;
    return !!familiaLectura && alumno.idfamilia === familiaLectura;
  }

  alumnoRelacionLabel(alumno: LecturaAsistidaAlumno): string {
    return this.esAlumnoNucleo(alumno) ? 'Nucleo familiar' : 'Alumno externo';
  }

  alumnoRelacionColor(alumno: LecturaAsistidaAlumno): string {
    return this.esAlumnoNucleo(alumno) ? 'success' : 'tertiary';
  }

  cambiarSentido(sentido: SentidoAcceso): void {
    this.sentido = sentido;
    if (sentido === 'ENTRADA') {
      this.modoAviso = false;
      this.idcarruselsesionSeleccionada = null;
    }
    this.resetLectura();
  }

  async resolver(): Promise<void> {
    const codigo = this.codigo.trim();
    if (!codigo) {
      await this.showToast('Captura o lee un codigo de credencial.', 'warning');
      return;
    }

    const sentidoLectura = this.esCodigoPaseExterno(codigo) ? 'SALIDA' : this.sentido;
    if (sentidoLectura !== this.sentido) {
      this.sentido = sentidoLectura;
      this.modoAviso = false;
    }

    this.loading = true;
    this.resetLectura(false);
    this.cdRef.detectChanges();

    try {
      const lectura = await firstValueFrom(this.lecturaService.resolverLectura({
        idorg: this.idorg,
        codigo,
        sentido: sentidoLectura,
        mostrarFoto: this.mostrarFoto,
        iduas: this.iduasFiltroRequest(),
      }));

      this.aplicarLectura(lectura);
    } catch (error: any) {
      await this.showToast(this.requestErrorMessage(error, 'No fue posible validar la credencial.'), 'danger');
    } finally {
      this.loading = false;
      this.cdRef.detectChanges();
    }
  }

  async abrirBusquedaManual(): Promise<void> {
    if (!this.puedeIdentificarManualmente) {
      await this.showToast('No tienes permiso para identificar personas manualmente.', 'warning');
      return;
    }

    this.modalBusquedaAbierto = true;
    this.textoBusquedaIdentidad = '';
    this.resultadosIdentidad = [];
  }

  cerrarBusquedaManual(): void {
    if (this.buscandoIdentidad || this.loading) {
      return;
    }

    this.modalBusquedaAbierto = false;
  }

  cambiarTipoBusquedaIdentidad(tipo: TipoBusquedaIdentidad): void {
    this.tipoBusquedaIdentidad = tipo;
    this.resultadosIdentidad = [];
  }

  async buscarIdentidades(): Promise<void> {
    const searchText = this.textoBusquedaIdentidad.trim();
    if (searchText.length < 3) {
      await this.showToast('Captura al menos 3 caracteres para buscar.', 'warning');
      return;
    }

    this.buscandoIdentidad = true;
    try {
      const response = await firstValueFrom(this.lecturaService.buscarIdentidades(
        this.idorg,
        this.tipoBusquedaIdentidad,
        searchText
      ));
      this.resultadosIdentidad = response.resultados ?? [];
    } catch (error: any) {
      this.resultadosIdentidad = [];
      await this.showToast(this.requestErrorMessage(error, 'No fue posible buscar personas.'), 'danger');
    } finally {
      this.buscandoIdentidad = false;
      this.cdRef.detectChanges();
    }
  }

  async seleccionarIdentidad(identidad: IdentidadLecturaAsistida): Promise<void> {
    if (!identidad.credencialDisponible) {
      await this.showToast(identidad.motivoNoDisponible || 'La identidad no esta disponible.', 'warning');
      return;
    }

    this.loading = true;
    this.resetLectura(false);
    try {
      const lectura = await firstValueFrom(this.lecturaService.resolverIdentidadManual({
        idorg: this.idorg,
        idmatricula: identidad.idmatricula ?? null,
        idusrbtMiembro: identidad.idusrbt ?? null,
        sentido: this.sentido,
        mostrarFoto: this.mostrarFoto,
        iduas: this.iduasFiltroRequest(),
      }));

      this.identificacionManual = true;
      this.identidadManualSeleccionada = identidad;
      this.codigo = '';
      this.aplicarLectura(lectura);
      this.modalBusquedaAbierto = false;
    } catch (error: any) {
      await this.showToast(this.requestErrorMessage(error, 'No fue posible validar la identidad.'), 'danger');
    } finally {
      this.loading = false;
      this.cdRef.detectChanges();
    }
  }

  cambiarTipoEntrega(tipo: TipoEntregaSalida): void {
    this.tipoEntrega = tipo;
    if (tipo !== 'AUTO') {
      this.idautofamiliarSeleccionado = null;
    } else if (!this.idautofamiliarSeleccionado && this.autos.length > 0) {
      this.idautofamiliarSeleccionado = this.autos[0].idautofamiliar;
    }
  }

  toggleAlumno(alumno: LecturaAsistidaAlumno, checked: boolean): void {
    if (!this.alumnoDisponible(alumno)) {
      return;
    }

    if (checked) {
      this.seleccion.add(alumno.idmatricula);
    } else {
      this.seleccion.delete(alumno.idmatricula);
    }
  }

  alumnoSeleccionado(alumno: LecturaAsistidaAlumno): boolean {
    return this.seleccion.has(alumno.idmatricula);
  }

  alumnoDisponible(alumno: LecturaAsistidaAlumno): boolean {
    return alumno.disponible !== false && !alumno.permisoAusencia;
  }

  async registrar(): Promise<void> {
    if (!this.lectura || !this.puedeRegistrar) {
      await this.showToast(this.entregaSalidaValida ? 'Selecciona al menos un alumno disponible.' : 'Selecciona la forma de entrega.', 'warning');
      return;
    }

    if (this.modoAviso) {
      await this.registrarAvisoCarrusel();
      return;
    }

    this.saving = true;
    const alumnos = this.alumnos
      .filter((alumno) => this.seleccion.has(alumno.idmatricula) && this.alumnoDisponible(alumno))
      .map((alumno) => ({
        idmatricula: alumno.idmatricula,
        idalumnoautorizacion: alumno.idalumnoautorizacion ?? null,
        idfamiliamiembro: alumno.idfamiliamiembro ?? this.lectura?.familiar?.idfamiliamiembro ?? null,
      }));

    this.lecturaService.registrarLectura({
      idorg: this.idorg,
      identificacionManual: this.identificacionManual,
      idmatricula: this.identificacionManual ? this.identidadManualSeleccionada?.idmatricula ?? null : null,
      idusrbtMiembro: this.identificacionManual ? this.identidadManualSeleccionada?.idusrbt ?? null : null,
      codigo: this.identificacionManual ? null : this.codigo.trim(),
      codigoLeido: this.identificacionManual ? null : this.codigo.trim(),
      sentido: this.sentido,
      modoAviso: false,
      idautofamiliar: this.tipoEntrega === 'AUTO' ? this.idautofamiliarSeleccionado : null,
      otroAuto: this.tipoEntrega === 'OTRO_AUTO' || this.tipoEntrega === 'PEATONAL',
      comentarios: this.comentariosEntrega(),
      origenModulo: this.identificacionManual ? 'LECTURA_ASISTIDA_MANUAL' : 'LECTURA_ASISTIDA_APP',
      alumnos,
    }).subscribe({
      next: async () => {
        const sentidoRegistrado = this.sentido;
        this.saving = false;
        this.resetLectura();
        await this.showToast(
          `${sentidoRegistrado === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada correctamente. Lista para la siguiente lectura.`,
          'success'
        );
      },
      error: async (error) => {
        this.saving = false;
        await this.showToast(this.requestErrorMessage(error, 'No fue posible registrar la lectura.'), 'danger');
      },
    });
  }

  private async registrarAvisoCarrusel(): Promise<void> {
    if (!this.lectura || !this.idcarruselsesionSeleccionada) {
      await this.showToast('Selecciona un carrusel abierto para enviar el aviso.', 'warning');
      return;
    }

    this.saving = true;
    const alumnos = this.alumnos
      .filter((alumno) => this.seleccion.has(alumno.idmatricula) && this.alumnoDisponible(alumno))
      .map((alumno) => ({
        idmatricula: alumno.idmatricula,
        idalumnoautorizacion: alumno.idalumnoautorizacion ?? null,
        idfamiliamiembro: alumno.idfamiliamiembro ?? this.lectura?.familiar?.idfamiliamiembro ?? null,
      }));

    try {
      const paquete = await firstValueFrom(this.carruselService.registrarAviso(this.idcarruselsesionSeleccionada, {
        idorg: this.idorg,
        idcarruseldispositivo: this.puntoLecturaCarrusel?.idcarruseldispositivo ?? null,
        codigo: this.identificacionManual ? null : this.codigo.trim(),
        codigoLeido: this.identificacionManual ? 'IDENTIFICACION_MANUAL' : this.codigo.trim(),
        idfamiliamiembro: this.lectura.familiar?.idfamiliamiembro ?? null,
        idinvitadoexternoRecoge: this.lectura.familiar?.idinvitadoexterno ?? null,
        idautofamiliar: this.tipoEntrega === 'AUTO' ? this.idautofamiliarSeleccionado : null,
        otroAuto: this.tipoEntrega === 'OTRO_AUTO' || this.tipoEntrega === 'PEATONAL',
        entregaPeatonal: this.tipoEntrega === 'PEATONAL',
        comentarios: this.comentariosEntrega(),
        alumnos,
      }));

      if (!paquete?.idcarrusellectura || !(paquete.alumnos?.length)) {
        throw new Error('El aviso no genero un paquete de carrusel. Intenta nuevamente o refresca el carrusel destino.');
      }

      const carrusel = this.carruselSeleccionado?.nombrePuntoEntrega || 'Carrusel';
      this.saving = false;
      this.resetLectura();
      await this.showToast(`Aviso enviado a ${carrusel}. Lista para la siguiente lectura.`, 'success');
    } catch (error: any) {
      this.saving = false;
      await this.showToast(this.requestErrorMessage(error, 'No fue posible enviar el aviso al carrusel.'), 'danger');
    }
  }

  async cambiarCarruselDestino(idcarruselsesion: number | string | null): Promise<void> {
    const parsed = Number(idcarruselsesion);
    this.idcarruselsesionSeleccionada = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    await this.conectarPuntoCarruselSeleccionado();
  }

  private async conectarPuntoCarruselSeleccionado(): Promise<void> {
    if (!this.modoAviso || !this.idorg || !this.idcarruselsesionSeleccionada) {
      return;
    }

    try {
      await this.carruselService.conectar(this.idorg, this.idcarruselsesionSeleccionada);
      let punto = this.puntoLecturaCarrusel;

      if (!punto) {
        punto = await firstValueFrom(this.carruselService.registrarPunto({
          idorg: this.idorg,
          idcarruselsesion: this.idcarruselsesionSeleccionada,
          rolOperativo: 'LECTURA',
          dispositivoUid: this.dispositivoUid(),
          nombreDispositivo: this.nombreDispositivo(),
        }));
      }

      if (punto.idcarruselsesion !== this.idcarruselsesionSeleccionada || punto.estatusConexion !== 'ASIGNADO') {
        punto = await firstValueFrom(this.carruselService.asociarPunto(
          this.idcarruselsesionSeleccionada,
          punto.idcarruseldispositivo,
          { idorg: this.idorg }
        ));
      }

      this.puntoLecturaCarrusel = punto;
    } catch (error: any) {
      this.puntoLecturaCarrusel = null;
      await this.showToast(this.requestErrorMessage(error, 'No fue posible conectar el lector al carrusel.'), 'danger');
    } finally {
      this.cdRef.detectChanges();
    }
  }

  private async desconectarPuntoCarrusel(): Promise<void> {
    const punto = this.puntoLecturaCarrusel;
    this.puntoLecturaCarrusel = null;

    if (!punto?.idcarruseldispositivo || !this.idorg) {
      return;
    }

    try {
      await firstValueFrom(this.carruselService.desconectarPunto(punto.idcarruseldispositivo, { idorg: this.idorg }));
    } catch {
      // La desconexion del indicador no debe bloquear la operacion del lector.
    } finally {
      this.cdRef.detectChanges();
    }
  }

  private dispositivoUid(): string {
    const key = 'seclife.control-accesos.device.uid';
    const legacyKeys = ['seclife.carrusel.device.uid', 'seclife.lectura-asistida.device.uid'];
    let uid = localStorage.getItem(key);
    if (!uid) {
      uid = legacyKeys.map((legacyKey) => localStorage.getItem(legacyKey)).find((value) => !!value) ?? null;
    }
    if (!uid) {
      uid = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    }
    localStorage.setItem(key, uid);
    legacyKeys.forEach((legacyKey) => localStorage.setItem(legacyKey, uid));
    return uid;
  }

  private nombreDispositivo(): string {
    return this.authService.getDisplayName() || 'Punto lector';
  }

  async activarQr(): Promise<void> {
    if (this.loading || this.saving || this.qrActivo) {
      return;
    }

    const reactivarNfc = this.nfcHabilitadoPorUsuario && this.nfcActivo;
    if (reactivarNfc) {
      await this.detenerLecturaNfc();
    }

    this.qrActivo = true;

    try {
      const result = await scanQrCode({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        scanInstructions: 'Alinea el codigo QR dentro del recuadro.',
        scanButton: false,
        scanText: 'Escanear QR',
        cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
        scanOrientation: CapacitorBarcodeScannerScanOrientation.PORTRAIT,
        web: {
          showCameraSelection: true,
          scannerFPS: 10,
        },
      });

      const codigoLeido = (result.ScanResult ?? '').trim();
      if (!codigoLeido) {
        await this.showToast('No se detecto un codigo QR valido.', 'warning');
        return;
      }

      this.codigo = codigoLeido;
      this.cdRef.detectChanges();
      await this.resolver();
    } catch (error) {
      await this.showToast('Lectura QR cancelada o no disponible.', 'medium');
    } finally {
      this.qrActivo = false;
      if (this.paginaActiva && reactivarNfc) {
        await this.restaurarNfcDespuesQr();
      }
    }
  }

  async toggleModoAviso(): Promise<void> {
    if (this.sentido === 'ENTRADA') {
      this.modoAviso = false;
      this.idcarruselsesionSeleccionada = null;
      void this.desconectarPuntoCarrusel();
      return;
    }

    this.modoAviso = !this.modoAviso;
    if (!this.modoAviso) {
      this.idcarruselsesionSeleccionada = null;
      await this.desconectarPuntoCarrusel();
      return;
    }

    await this.cargarCarruselesActivos();
  }

  async cargarCarruselesActivos(mostrarAvisoSinCarruseles = true): Promise<void> {
    if (!this.idorg) {
      return;
    }

    this.cargandoCarruseles = true;
    try {
      const sesiones = await firstValueFrom(this.carruselService.listarSesiones(this.idorg));
      const uidDispositivoActual = this.dispositivoUid();
      this.carruselesActivos = sesiones.filter((sesion) =>
        (sesion.estatus ?? '').toUpperCase() === 'ABIERTA'
        && (sesion.dispositivoEntregaUid ?? '') !== uidDispositivoActual
      );
      if (
        this.idcarruselsesionSeleccionada
        && !this.carruselesActivos.some((sesion) => sesion.idcarruselsesion === this.idcarruselsesionSeleccionada)
      ) {
        this.idcarruselsesionSeleccionada = null;
      }

      if (!this.idcarruselsesionSeleccionada && this.carruselesActivos.length === 1) {
        this.idcarruselsesionSeleccionada = this.carruselesActivos[0].idcarruselsesion;
        await this.conectarPuntoCarruselSeleccionado();
      }

      if (mostrarAvisoSinCarruseles && !this.carruselesActivos.length) {
        await this.showToast('No hay carruseles abiertos para recibir avisos.', 'warning');
      }
    } catch (error: any) {
      await this.showToast(this.requestErrorMessage(error, 'No fue posible consultar carruseles activos.'), 'danger');
    } finally {
      this.cargandoCarruseles = false;
      this.cdRef.detectChanges();
    }
  }

  async activarNfc(automatico = false): Promise<void> {
    if (this.loading || this.saving || this.qrActivo) {
      return;
    }

    if (automatico && !this.nfcHabilitadoPorUsuario) {
      return;
    }

    if (this.nfcActivo) {
      if (automatico) {
        return;
      }

      this.nfcHabilitadoPorUsuario = false;
      this.limpiarRecuperacionNfc();
      await this.detenerLecturaNfc();
      await this.showToast('Lectura NFC desactivada.', 'medium');
      return;
    }

    if (!automatico) {
      this.nfcHabilitadoPorUsuario = true;
    }

    try {
      const { supported } = await CapacitorNfc.isSupported();
      if (!supported) {
        if (!automatico) {
          await this.showToast('Este dispositivo no cuenta con NFC.', 'warning');
        }
        return;
      }

      const { status } = await CapacitorNfc.getStatus();
      if (status === 'NFC_DISABLED') {
        if (!automatico) {
          await this.showToast('Activa NFC en el dispositivo para leer credenciales fisicas.', 'warning');
        }
        return;
      }

      if (!this.paginaActiva) {
        return;
      }

      await this.detenerLecturaNfc(false);
      this.nfcListener = await CapacitorNfc.addListener('nfcEvent', (event: NfcEvent) => {
        this.zone.run(() => {
          void this.procesarLecturaNfc(event);
        });
      });
      await CapacitorNfc.startScanning({
        invalidateAfterFirstRead: false,
        alertMessage: 'Acerca la credencial NFC al dispositivo.',
        iosSessionType: 'tag',
      });
      this.nfcActivo = true;
      if (!automatico) {
        await this.showToast('NFC listo. Acerca la credencial al dispositivo.', 'medium');
      }
    } catch (error) {
      await this.detenerLecturaNfc();
      if (!automatico) {
        await this.showToast('No fue posible activar la lectura NFC.', 'danger');
      }
    }
  }

  async abrirFiltroUa(): Promise<void> {
    await this.cargarUnidadesAdministrativas();

    if (!this.unidadesAdministrativas.length) {
      await this.showToast('No hay unidades administrativas disponibles para filtrar.', 'medium');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Unidades administrativas',
      subHeader: 'Selecciona las unidades permitidas para esta lectura.',
      inputs: this.unidadesAdministrativas.map((unidad) => ({
        type: 'checkbox',
        label: unidad.descripcion,
        value: unidad.idua,
        checked: this.unidadesSeleccionadas.has(unidad.idua),
      })),
      buttons: [
        {
          text: 'Todas',
          role: 'all',
          handler: () => {
            this.unidadesSeleccionadas = new Set(this.unidadesAdministrativas.map((unidad) => unidad.idua));
            this.cdRef.detectChanges();
          },
        },
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Aplicar',
          role: 'confirm',
          handler: async (values: number[]) => {
            if (!values?.length) {
              await this.showToast('Selecciona al menos una unidad administrativa.', 'warning');
              return false;
            }

            this.unidadesSeleccionadas = new Set(values.map((value) => Number(value)));
            this.cdRef.detectChanges();
            return true;
          },
        },
      ],
    });

    await alert.present();
  }

  limpiar(): void {
    this.codigo = '';
    this.resetLectura();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    void this.desconectarPuntoCarrusel();
    this.paginaActiva = false;
    this.limpiarRecuperacionNfc();
    void this.detenerLecturaNfc();
  }

  fotoSrc(value?: string | null): string | null {
    if (!value || !this.mostrarFoto) {
      return null;
    }

    return value.startsWith('data:') ? value : `data:image/jpeg;base64,${value}`;
  }

  estadoAlumno(alumno: LecturaAsistidaAlumno): string {
    if (alumno.permisoAusencia) {
      return 'PERMISO DE AUSENCIA';
    }

    if (this.alumnoRequiereEntregaFamiliar(alumno)) {
      return 'REQUIERE ENTREGA A FAMILIAR';
    }

    if (this.alumnoEnAvisoCarrusel(alumno)) {
      return 'MODO AVISO';
    }

    if (this.alumnoConSalidaRegistrada(alumno)) {
      return 'REGISTRO DE SALIDA';
    }

    if (this.alumnoAdvertenciaRepetida(alumno)) {
      return `${this.sentido === 'ENTRADA' ? 'Entrada' : 'Salida'} ya registrada`;
    }

    if (this.alumnoSinEntradaParaSalida(alumno)) {
      return 'Sin entrada registrada';
    }

    return 'Disponible';
  }

  alumnoAdvertenciaRepetida(alumno: LecturaAsistidaAlumno): boolean {
    return alumno.ultimaLectura?.sentido === this.sentido;
  }

  alumnoRequiereEntregaFamiliar(alumno: LecturaAsistidaAlumno): boolean {
    return this.sentido === 'SALIDA'
      && this.lectura?.tipoLectura === 'ALUMNO'
      && alumno.salidaAutonomaAutorizada !== true;
  }

  alumnoEnAvisoCarrusel(alumno: LecturaAsistidaAlumno): boolean {
    return this.sentido === 'SALIDA' && (alumno.estatusSalida ?? '').toUpperCase() === 'MODO_AVISO';
  }

  alumnoConSalidaRegistrada(alumno: LecturaAsistidaAlumno): boolean {
    return this.sentido === 'SALIDA' && (alumno.estatusSalida ?? '').toUpperCase() === 'REGISTRO_SALIDA';
  }

  alumnoSinEntradaParaSalida(alumno: LecturaAsistidaAlumno): boolean {
    return this.sentido === 'SALIDA' && !alumno.ultimaLectura;
  }

  estadoColor(alumno: LecturaAsistidaAlumno): string {
    if (this.alumnoConSalidaRegistrada(alumno)) {
      return 'medium';
    }

    if (this.alumnoRequiereEntregaFamiliar(alumno)) {
      return 'danger';
    }

    if (alumno.permisoAusencia || this.alumnoAdvertenciaRepetida(alumno) || this.alumnoSinEntradaParaSalida(alumno)) {
      return 'warning';
    }

    if (this.alumnoEnAvisoCarrusel(alumno)) {
      return 'tertiary';
    }

    return 'success';
  }

  autoLabel(auto: LecturaAsistidaAuto): string {
    return [auto.placas, auto.marca, auto.modelo, auto.color].filter(Boolean).join(' | ');
  }

  private async procesarLecturaNfc(event: NfcEvent): Promise<void> {
    if (this.nfcProcesando || this.loading || this.saving) {
      return;
    }

    this.limpiarRecuperacionNfc();
    const codigoLeido = this.extraerCodigoNfc(event);
    if (!codigoLeido) {
      await this.showToast('No se pudo obtener un codigo valido del TAG NFC.', 'warning');
      return;
    }

    const now = Date.now();
    if (codigoLeido === this.ultimoCodigoNfc && now - this.ultimaLecturaNfcAt < 1500) {
      return;
    }

    this.nfcProcesando = true;
    this.ultimoCodigoNfc = codigoLeido;
    this.ultimaLecturaNfcAt = now;
    void this.emitirConfirmacionLectura();

    try {
      this.codigo = codigoLeido;
      this.cdRef.detectChanges();
      await this.resolver();
    } finally {
      this.nfcProcesando = false;
      if (this.paginaActiva && this.nfcActivo) {
        await this.delay(250);
        await this.reiniciarEscaneoNfc();
      }
    }
  }

  private async emitirConfirmacionLectura(): Promise<void> {
    await this.prepararAudioLectura();
    this.emitirBeep();
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Algunos entornos web o dispositivos pueden no soportar vibracion.
    }
  }

  private async prepararAudioLectura(): Promise<void> {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }

      this.audioContext ??= new AudioContextClass();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    } catch {
      // El audio es auxiliar; no debe bloquear la lectura.
    }
  }

  private emitirBeep(): void {
    try {
      if (!this.audioContext) {
        return;
      }

      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const now = this.audioContext.currentTime;

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.35, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.15);
    } catch {
      // El beep es auxiliar; no debe bloquear el registro de lectura.
    }
  }
  private extraerCodigoNfc(event: NfcEvent): string | null {
    for (const record of event.tag?.ndefMessage ?? []) {
      const recordText = this.extraerTextoNdef(record);
      if (recordText) {
        return recordText;
      }
    }

    return this.extraerCodigoDesdeUid(event.tag?.id);
  }

  private extraerTextoNdef(record: NdefRecord): string | null {
    if (!record.payload?.length) {
      return null;
    }

    const type = this.bytesToAscii(record.type).toUpperCase();
    let payload = record.payload;

    if (type === 'T' && payload.length > 1) {
      const languageLength = payload[0] & 0x3f;
      payload = payload.slice(1 + languageLength);
    } else if (type === 'U' && payload.length > 1) {
      payload = payload.slice(1);
    }

    return this.normalizarCodigoNfc(this.bytesToUtf8(payload));
  }

  private extraerCodigoDesdeUid(uid?: number[]): string | null {
    if (!uid?.length) {
      return null;
    }

    const decimal = this.bytesToBigInt([...uid].reverse()).toString().padStart(10, '0');
    return this.normalizarCodigoNfc(decimal);
  }

  private normalizarCodigoNfc(value: string): string | null {
    const codigo = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
    return codigo.length ? codigo : null;
  }

  private bytesToUtf8(bytes: number[]): string {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  }

  private bytesToAscii(bytes: number[]): string {
    return String.fromCharCode(...bytes);
  }

  private bytesToBigInt(bytes: number[]): bigint {
    return bytes.reduce((value, byte) => (value << 8n) + BigInt(byte & 0xff), 0n);
  }

  private async iniciarEscaneoNfc(): Promise<void> {
    await CapacitorNfc.startScanning({
      invalidateAfterFirstRead: false,
      alertMessage: 'Acerca la credencial NFC al dispositivo.',
      iosSessionType: 'tag',
    });
  }
  private async cargarUnidadesAdministrativas(): Promise<void> {
    if (this.unidadesAdministrativas.length || this.cargandoUnidades || !this.idorg) {
      return;
    }

    this.cargandoUnidades = true;
    try {
      const unidades = await firstValueFrom(this.lecturaService.consultarUnidadesAdministrativas(this.idorg));
      this.unidadesAdministrativas = unidades.filter((unidad) => unidad.sitactivo !== false);
      this.unidadesSeleccionadas = new Set(this.unidadesAdministrativas.map((unidad) => unidad.idua));
    } catch {
      await this.showToast('No fue posible cargar unidades administrativas.', 'danger');
    } finally {
      this.cargandoUnidades = false;
      this.cdRef.detectChanges();
    }
  }

  private iduasFiltroRequest(): number[] | null {
    if (!this.unidadesAdministrativas.length || this.unidadesSeleccionadas.size === this.unidadesAdministrativas.length) {
      return null;
    }

    return [...this.unidadesSeleccionadas];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async restaurarNfcDespuesQr(): Promise<void> {
    const ultimaLecturaAntesDeRecuperar = this.ultimaLecturaNfcAt;
    await this.delay(1200);

    if (!this.paginaActiva || !this.nfcHabilitadoPorUsuario || this.qrActivo) {
      return;
    }

    await this.activarNfc(true);
    if (!this.nfcActivo) {
      return;
    }

    this.limpiarRecuperacionNfc();
    this.nfcRecoveryTimer = setTimeout(() => {
      this.nfcRecoveryTimer = null;
      this.zone.run(() => {
        void this.verificarRecuperacionNfc(ultimaLecturaAntesDeRecuperar);
      });
    }, 2500);
  }

  private async verificarRecuperacionNfc(ultimaLecturaAntesDeRecuperar: number): Promise<void> {
    if (
      !this.paginaActiva
      || !this.nfcHabilitadoPorUsuario
      || this.qrActivo
      || this.loading
      || this.saving
      || this.ultimaLecturaNfcAt !== ultimaLecturaAntesDeRecuperar
    ) {
      return;
    }

    await this.detenerLecturaNfc();
    await this.delay(250);
    await this.activarNfc(true);
  }

  private limpiarRecuperacionNfc(): void {
    if (this.nfcRecoveryTimer) {
      clearTimeout(this.nfcRecoveryTimer);
      this.nfcRecoveryTimer = null;
    }
  }

  private async reiniciarEscaneoNfc(): Promise<void> {
    try {
      await CapacitorNfc.stopScanning();
    } catch {
      // Puede no haber una sesion activa despues de una lectura.
    }

    try {
      await this.iniciarEscaneoNfc();
    } catch {
      this.nfcActivo = false;
      if (this.paginaActiva) {
        await this.showToast('La lectura NFC se detuvo. Activa NFC nuevamente.', 'warning');
      }
    }
  }
  private async detenerLecturaNfc(updateState = true): Promise<void> {
    if (this.nfcListener) {
      await this.nfcListener.remove();
      this.nfcListener = null;
    }

    try {
      await CapacitorNfc.stopScanning();
    } catch {
      // El plugin puede rechazar si no habia una sesion activa.
    }

    if (updateState) {
      this.nfcActivo = false;
    }
  }
  private esCodigoPaseExterno(codigo: string): boolean {
    return /^\d{6}$/.test(codigo.trim());
  }

  private resetLectura(clearCode = true): void {
    this.lectura = null;
    this.identificacionManual = false;
    this.identidadManualSeleccionada = null;
    this.seleccion.clear();
    this.tipoEntrega = null;
    this.idautofamiliarSeleccionado = null;
    if (clearCode) {
      this.codigo = '';
    }
  }

  private aplicarLectura(lectura: LecturaAsistidaResponse): void {
    this.lectura = lectura;
    for (const alumno of lectura.alumnos ?? []) {
      if (this.alumnoDisponible(alumno) && this.esAlumnoNucleo(alumno)) {
        this.seleccion.add(alumno.idmatricula);
      }
    }
    this.preseleccionarEntrega();
  }

  private preseleccionarEntrega(): void {
    if (!this.requiereEntregaSalida) {
      return;
    }

    if (this.autos.length > 0) {
      this.tipoEntrega = 'AUTO';
      this.idautofamiliarSeleccionado = this.autos[0].idautofamiliar;
      return;
    }

    this.tipoEntrega = 'OTRO_AUTO';
    this.idautofamiliarSeleccionado = null;
  }

  private comentariosEntrega(): string | null {
    if (this.sentido !== 'SALIDA') {
      return null;
    }

    if (this.tipoEntrega === 'PEATONAL') {
      return 'ENTREGA PEATONAL';
    }

    if (this.tipoEntrega === 'OTRO_AUTO') {
      return 'ENTREGA EN OTRO AUTO';
    }

    return null;
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2600,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

  private requestErrorMessage(error: any, fallback: string): string {
    if (error?.status === 401) {
      return 'La sesion vencio. Inicia sesion nuevamente para continuar.';
    }
    if (error?.status === 0) {
      return 'No fue posible conectar con Seclife. Revisa tu conexion WiFi o datos moviles e intenta nuevamente.';
    }
    return error?.error?.message || fallback;
  }
}
