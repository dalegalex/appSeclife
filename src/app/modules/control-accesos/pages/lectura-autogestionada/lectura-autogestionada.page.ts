import { Component, NgZone, OnDestroy } from '@angular/core';
import {
  CapacitorBarcodeScannerCameraDirection,
  CapacitorBarcodeScannerScanOrientation,
  CapacitorBarcodeScannerTypeHint,
} from '@capacitor/barcode-scanner';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { CapacitorNfc, NfcEvent, NdefRecord, PluginListenerHandle } from '@capgo/capacitor-nfc';
import { AlertController, ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { scanQrCode } from '../../../../core/qr-scanner';
import {
  AutogestionEvento,
  AutogestionEventoLectura,
  AutogestionPunto,
  AutogestionSesion,
  AutogestionArea,
  AutogestionAsistenciaLectura,
} from '../../models/lectura-autogestionada.model';
import { LecturaAutogestionadaService } from '../../services/lectura-autogestionada.service';

type ModoAutogestion = 'EVENTO' | 'ASISTENCIA';

interface SeclifeTextToSpeechPlugin {
  speak(options: { text: string }): Promise<{ spoken: boolean }>;
}

const SeclifeTextToSpeech = registerPlugin<SeclifeTextToSpeechPlugin>('SeclifeTextToSpeech');

@Component({
  selector: 'app-lectura-autogestionada',
  templateUrl: './lectura-autogestionada.page.html',
  styleUrls: ['./lectura-autogestionada.page.scss'],
  standalone: false,
})
export class LecturaAutogestionadaPage implements OnDestroy {
  modo: ModoAutogestion = 'EVENTO';
  eventos: AutogestionEvento[] = [];
  puntos: AutogestionPunto[] = [];
  areas: AutogestionArea[] = [];
  sesion: AutogestionSesion | null = null;
  ideventoacceso: number | null = null;
  idpuntoautogestion: number | null = null;
  idareavisita: number | null = null;
  codigo = '';
  lectura: AutogestionEventoLectura | null = null;
  lecturaAsistencia: AutogestionAsistenciaLectura | null = null;
  participantes = 1;
  loadingCatalogos = false;
  loadingLectura = false;
  saving = false;
  nfcActivo = false;
  nfcDisponible = true;
  nfcEstado: 'ACTIVO' | 'INACTIVO' | 'NO_DISPONIBLE' | 'DESHABILITADO' = 'INACTIVO';
  idmedioIdentificacionActual = 1;
  private nfcListener: PluginListenerHandle | null = null;
  private nfcProcesando = false;
  private ultimoCodigoNfc: string | null = null;
  private ultimaLecturaNfcAt = 0;
  private audioContext: AudioContext | null = null;
  relojActual = new Date();
  private relojTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly service: LecturaAutogestionadaService,
    private readonly authService: AuthService,
    private readonly toastController: ToastController,
    private readonly alertController: AlertController,
    private readonly zone: NgZone
  ) {}

  ionViewWillEnter(): void {
    this.iniciarReloj();
    void this.cargarCatalogos();
  }

  ionViewDidEnter(): void {
    void this.activarNfcPorDefault();
  }

  ionViewWillLeave(): void {
    this.detenerReloj();
    void this.detenerLecturaNfc(false);
  }

  ngOnDestroy(): void {
    this.detenerReloj();
    void this.detenerLecturaNfc(false);
  }

  get idorg(): number {
    return this.authService.getCurrentUser()?.idorg ?? 0;
  }

  get eventoSeleccionado(): AutogestionEvento | null {
    return this.eventos.find((evento) => evento.ideventoacceso === this.ideventoacceso) ?? null;
  }

  get puntoSeleccionado(): AutogestionPunto | null {
    return this.puntos.find((punto) => punto.idpuntoautogestion === this.idpuntoautogestion) ?? null;
  }

  get maxParticipantes(): number {
    return Number(this.lectura?.maxParticipantesFamilia ?? this.eventoSeleccionado?.maxParticipantesFamilia ?? 0);
  }

  get permiteParticipantes(): boolean {
    const esContextoFamiliar = Number(this.lectura?.idperfil ?? 0) === 4 || !!this.lectura?.idinvitacion;
    return esContextoFamiliar
      && (this.lectura?.siguienteMovimiento ?? 'ENTRADA') === 'ENTRADA'
      && this.maxParticipantes !== 1;
  }

  get puedeRegistrar(): boolean {
    return !!this.lectura && !this.saving;
  }

  get requiereSeleccionAreaAsistencia(): boolean {
    return this.modo === 'ASISTENCIA'
      && !!this.lecturaAsistencia
      && Number(this.lecturaAsistencia.idperfil ?? 0) === 4
      && (this.lecturaAsistencia.siguienteMovimiento ?? 'ENTRADA') === 'ENTRADA'
      && this.areas.length > 0;
  }

  get puedeRegistrarAsistencia(): boolean {
    return !!this.lecturaAsistencia
      && !this.saving
      && (!this.requiereSeleccionAreaAsistencia || !!this.idareavisita);
  }

  get perfilAsistenciaLabel(): string | null {
    const idperfil = Number(this.lecturaAsistencia?.idperfil ?? 0);
    if (idperfil === 5) {
      return 'ALUMNO';
    }
    if (idperfil >= 1 && idperfil <= 3) {
      return 'PERSONAL DEL COLEGIO';
    }
    return null;
  }

  get sesionAbierta(): boolean {
    return (this.sesion?.estatus ?? '').toUpperCase() === 'ABIERTA';
  }

  get controlesOperadorBloqueados(): boolean {
    return this.sesionAbierta;
  }

  get nfcColor(): 'success' | 'danger' | 'medium' {
    if (this.nfcEstado === 'ACTIVO') {
      return 'success';
    }
    if (this.nfcEstado === 'NO_DISPONIBLE' || this.nfcEstado === 'DESHABILITADO') {
      return 'danger';
    }
    return 'medium';
  }

  async cargarCatalogos(): Promise<void> {
    this.loadingCatalogos = true;
    try {
      const dispositivoUid = this.dispositivoUid();
      const catalogos = await firstValueFrom(this.service.consultarCatalogos(this.idorg, dispositivoUid));
      this.areas = (catalogos.areas ?? []).filter((area) => area.sitactivo !== false);
      this.puntos = (catalogos.puntos ?? []).filter((punto) => punto.sitactivo !== false);
      this.eventos = (catalogos.eventos ?? [])
        .filter((evento) => ['PROGRAMADO', 'ACTIVO'].includes((evento.estatus ?? '').toUpperCase()))
        .sort((a, b) => `${a.fechaEvento ?? ''} ${a.horaProgramada ?? ''}`.localeCompare(`${b.fechaEvento ?? ''} ${b.horaProgramada ?? ''}`));
      this.ideventoacceso = this.ideventoacceso ?? this.eventos[0]?.ideventoacceso ?? null;
      const puntoPropio = this.puntos.find((punto) => {
        const sesion = punto.sesionAbierta;
        return sesion?.esDispositivoActual === true || sesion?.dispositivoUid === dispositivoUid;
      });
      if (puntoPropio) {
        this.idpuntoautogestion = puntoPropio.idpuntoautogestion;
      } else if (!this.puntos.some((punto) => punto.idpuntoautogestion === this.idpuntoautogestion)) {
        this.idpuntoautogestion = this.puntos[0]?.idpuntoautogestion ?? null;
      }
      this.aplicarSesionAbiertaDePunto();
    } catch (error: any) {
      await this.showToast(error?.error?.message || error?.message || 'No fue posible consultar eventos.', 'danger');
    } finally {
      this.loadingCatalogos = false;
    }
  }

  async resolver(): Promise<void> {
    if (this.modo === 'ASISTENCIA') {
      this.idmedioIdentificacionActual = this.idmedioIdentificacionActual || 1;
      await this.resolverAsistencia();
      return;
    }

    if (!this.sesionAbierta) {
      await this.showToast('Configura y abre la sesion del punto antes de iniciar lecturas.', 'warning');
      return;
    }

    const codigo = this.codigo.trim();
    if (!this.ideventoacceso) {
      await this.showToast('Selecciona un evento.', 'warning');
      return;
    }
    if (!codigo) {
      await this.showToast('Captura o lee un codigo de credencial.', 'warning');
      return;
    }

    this.idmedioIdentificacionActual = this.idmedioIdentificacionActual || 1;
    this.loadingLectura = true;
    this.lectura = null;
    try {
      const lectura = await firstValueFrom(this.service.resolverEvento({
        idorg: this.idorg,
        ideventoacceso: this.ideventoacceso,
        idsesionautogestion: this.sesion?.idsesionautogestion,
        codigo,
      }));
      this.lectura = lectura;
      this.participantes = lectura.siguienteMovimiento === 'SALIDA' ? 0 : 1;
      await this.beep();
    } catch (error: any) {
      await this.showToast(error?.error?.message || error?.message || 'No fue posible validar la credencial.', 'danger');
    } finally {
      this.loadingLectura = false;
    }
  }

  async activarQr(): Promise<void> {
    try {
      const result = await scanQrCode({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
        scanOrientation: CapacitorBarcodeScannerScanOrientation.ADAPTIVE,
      });
      const scanned = result.ScanResult?.trim();
      if (scanned) {
        this.codigo = scanned;
        this.idmedioIdentificacionActual = 3;
        await this.resolver();
      }
    } catch (error: any) {
      await this.showToast(error?.message || 'No fue posible leer el codigo QR.', 'danger');
    } finally {
      await this.asegurarNfcOperativo();
    }
  }

  async activarNfc(): Promise<void> {
    if (this.sesionAbierta) {
      return;
    }

    if (this.loadingLectura || this.saving) {
      return;
    }

    if (this.sesionAbierta && this.sesion?.nfcHabilitado === false) {
      this.nfcEstado = 'DESHABILITADO';
      await this.showToast('NFC deshabilitado para este punto.', 'warning');
      return;
    }

    if (this.nfcActivo) {
      await this.detenerLecturaNfc();
      await this.showToast('Lectura NFC detenida.', 'medium');
      return;
    }

    await this.iniciarLecturaNfc(true);
  }

  async registrar(): Promise<void> {
    if (this.modo === 'ASISTENCIA') {
      await this.registrarAsistencia();
      return;
    }

    if (!this.lectura || !this.ideventoacceso) {
      await this.showToast('Primero valida una credencial.', 'warning');
      return;
    }

    this.saving = true;
    try {
      const registro = await firstValueFrom(this.service.registrarEvento({
        idorg: this.idorg,
        ideventoacceso: this.ideventoacceso,
        idsesionautogestion: this.sesion?.idsesionautogestion,
        codigo: this.codigo.trim(),
        codigoLeido: this.codigo.trim(),
        participantes: this.lectura.siguienteMovimiento === 'SALIDA' ? 0 : this.participantes,
        idmedioIdentificacion: this.idmedioIdentificacionActual,
      }));

      await this.beep();
      void this.hablar(registro.tipoMovimiento === 'SALIDA' ? 'Gracias por su asistencia.' : 'Bienvenido al evento.');
      await this.showToast(
        registro.tipoMovimiento === 'SALIDA' ? 'Gracias por su asistencia.' : 'Bienvenido al evento.',
        'success'
      );
      this.limpiarLectura();
      await this.asegurarNfcOperativo();
    } catch (error: any) {
      await this.showToast(error?.error?.message || error?.message || 'No fue posible registrar la lectura.', 'danger');
    } finally {
      this.saving = false;
    }
  }

  limpiarLectura(): void {
    this.codigo = '';
    this.lectura = null;
    this.lecturaAsistencia = null;
    this.participantes = 1;
    this.idmedioIdentificacionActual = 1;
  }

  cambiarModo(modo: ModoAutogestion): void {
    if (this.modo === modo) {
      return;
    }

    if (this.controlesOperadorBloqueados) {
      void this.showToast('Cierra la sesion para cambiar el modo.', 'warning');
      return;
    }

    this.modo = modo;
    this.limpiarLectura();
  }

  async configurarSesion(): Promise<void> {
    if (!this.idpuntoautogestion) {
      await this.showToast('Selecciona un punto autogestionado.', 'warning');
      return;
    }

    if (this.modo === 'EVENTO' && !this.ideventoacceso) {
      await this.showToast('Selecciona un evento.', 'warning');
      return;
    }

    const alert = await this.alertController.create({
      header: 'PIN de operador',
      message: 'Solo personal autorizado puede configurar este punto.',
      inputs: [
        {
          name: 'pin',
          type: 'password',
          placeholder: '6 digitos',
          attributes: {
            inputmode: 'numeric',
            maxlength: 6,
          },
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Abrir sesion',
          handler: (data) => {
            void this.abrirSesion(String(data?.pin ?? ''));
          },
        },
      ],
    });
    await alert.present();
  }

  async solicitarDesbloqueoConfiguracion(): Promise<void> {
    if (!this.sesion?.idsesionautogestion) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Liberar punto',
      message: 'Captura el PIN de operador para cerrar la sesion y liberar este punto.',
      inputs: [
        {
          name: 'pin',
          type: 'password',
          placeholder: '6 digitos',
          attributes: {
            inputmode: 'numeric',
            maxlength: 6,
          },
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Liberar',
          handler: (data) => {
            void this.cerrarSesion(String(data?.pin ?? ''));
          },
        },
      ],
    });
    await alert.present();
  }

  async cerrarSesion(pin: string): Promise<void> {
    if (!this.sesion?.idsesionautogestion) {
      return;
    }

    const pinOperador = pin.trim();
    if (!/^\d{6}$/.test(pinOperador)) {
      await this.showToast('Captura un PIN de 6 digitos.', 'warning');
      return;
    }

    try {
      await firstValueFrom(this.service.cerrarSesion(this.idorg, this.sesion.idsesionautogestion, pinOperador));
      await this.detenerLecturaNfc();
      this.sesion = null;
      this.limpiarLectura();
      await this.showToast('Punto liberado correctamente.', 'success');
      await this.cargarCatalogos();
    } catch (error: any) {
      await this.showToast(error?.error?.message || error?.message || 'No fue posible cerrar la sesion.', 'danger');
    }
  }

  eventoLabel(evento: AutogestionEvento): string {
    const fecha = evento.fechaEvento ? evento.fechaEvento.slice(0, 10) : '';
    const hora = evento.horaProgramada ? evento.horaProgramada.slice(0, 5) : '';
    return `${evento.nombre ?? 'EVENTO'} ${fecha} ${hora}`.trim();
  }

  private async activarNfcPorDefault(): Promise<void> {
    if (this.nfcActivo || !Capacitor.isNativePlatform()) {
      return;
    }

    await this.iniciarLecturaNfc(false);
  }

  private async asegurarNfcOperativo(): Promise<void> {
    if (!this.sesionAbierta || this.sesion?.nfcHabilitado === false || !Capacitor.isNativePlatform()) {
      return;
    }

    await this.delay(250);
    if (!this.nfcActivo || !this.nfcListener) {
      await this.iniciarLecturaNfc(false);
      return;
    }

    await this.reiniciarEscaneoNfc(false);
  }

  private async iniciarLecturaNfc(showReadyToast: boolean): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      if (showReadyToast) {
        await this.showToast('NFC solo esta disponible en dispositivo fisico.', 'warning');
      }
      return;
    }

    try {
      const { supported } = await CapacitorNfc.isSupported();
      if (!supported) {
        this.nfcDisponible = false;
        this.nfcEstado = 'NO_DISPONIBLE';
        if (showReadyToast) {
          await this.showToast('Este dispositivo no cuenta con NFC.', 'warning');
        }
        return;
      }

      const { status } = await CapacitorNfc.getStatus();
      if (status === 'NFC_DISABLED') {
        this.nfcDisponible = false;
        this.nfcEstado = 'NO_DISPONIBLE';
        if (showReadyToast) {
          await this.showToast('Activa NFC en el dispositivo para leer credenciales fisicas.', 'warning');
        }
        return;
      }

      await this.detenerLecturaNfc(false);
      this.nfcListener = await CapacitorNfc.addListener('nfcEvent', (event: NfcEvent) => {
        this.zone.run(() => {
          void this.procesarLecturaNfc(event);
        });
      });
      await this.iniciarEscaneoNfc();
      this.nfcActivo = true;
      this.nfcDisponible = true;
      this.nfcEstado = 'ACTIVO';
      if (showReadyToast) {
        await this.showToast('NFC listo. Acerca la credencial al dispositivo.', 'medium');
      }
    } catch {
      await this.detenerLecturaNfc(false);
      this.nfcEstado = 'NO_DISPONIBLE';
      if (showReadyToast) {
        await this.showToast('No fue posible activar la lectura NFC.', 'danger');
      }
    }
  }

  private async procesarLecturaNfc(event: NfcEvent): Promise<void> {
    if (this.nfcProcesando || this.loadingLectura || this.saving) {
      return;
    }

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
      this.idmedioIdentificacionActual = 4;
      await this.resolver();
    } finally {
      this.nfcProcesando = false;
      if (this.nfcActivo) {
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

  private async reiniciarEscaneoNfc(showStoppedToast = true): Promise<void> {
    try {
      await CapacitorNfc.stopScanning();
    } catch {
      // Puede no haber una sesion activa despues de una lectura.
    }

    try {
      await this.iniciarEscaneoNfc();
    } catch {
      this.nfcActivo = false;
      this.nfcEstado = 'INACTIVO';
      if (showStoppedToast) {
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
      this.nfcEstado = 'INACTIVO';
    }
  }

  private aplicarSesionAbiertaDePunto(): void {
    const punto = this.puntoSeleccionado;
    const sesion = punto?.sesionAbierta ?? null;
    const esSesionPropia = sesion?.esDispositivoActual === true
      || sesion?.dispositivoUid === this.dispositivoUid();
    if (!sesion?.idsesionautogestion || !esSesionPropia) {
      this.sesion = null;
      return;
    }

    this.sesion = sesion;
    this.modo = (sesion.modo === 'ASISTENCIA' ? 'ASISTENCIA' : 'EVENTO');
    this.ideventoacceso = sesion.ideventoacceso ?? this.ideventoacceso;
    this.idareavisita = sesion.idareavisita ?? null;
    if (sesion.nfcHabilitado === false) {
      this.nfcEstado = 'DESHABILITADO';
    }
  }

  private async abrirSesion(pin: string): Promise<void> {
    const pinOperador = pin.trim();
    if (!/^\d{6}$/.test(pinOperador)) {
      await this.showToast('Captura un PIN de 6 digitos.', 'warning');
      return;
    }

    try {
      const sesion = await firstValueFrom(this.service.abrirSesion({
        idorg: this.idorg,
        idpuntoautogestion: this.idpuntoautogestion as number,
        pinOperador,
        modo: this.modo,
        ideventoacceso: this.modo === 'EVENTO' ? this.ideventoacceso : null,
        idareavisita: null,
        ingresoAutomatico: true,
        emitirAudio: true,
        dispositivoUid: this.dispositivoUid(),
        nombreDispositivo: this.nombreDispositivo(),
      }));
      this.sesion = sesion;
      this.idareavisita = null;
      if (sesion.nfcHabilitado === false) {
        await this.detenerLecturaNfc();
        this.nfcEstado = 'DESHABILITADO';
      } else if (!this.nfcActivo) {
        await this.activarNfcPorDefault();
      }
      await this.showToast('Sesion abierta correctamente.', 'success');
    } catch (error: any) {
      await this.showToast(error?.error?.message || error?.message || 'No fue posible abrir la sesion.', 'danger');
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
    return this.authService.getDisplayName() || 'Dispositivo de autogestion';
  }

  private async resolverAsistencia(): Promise<void> {
    const codigo = this.codigo.trim();
    if (!this.sesionAbierta || !this.sesion?.idsesionautogestion) {
      await this.showToast('Configura y abre la sesion del punto antes de iniciar lecturas.', 'warning');
      return;
    }
    if (!codigo) {
      await this.showToast('Captura o lee un codigo de credencial.', 'warning');
      return;
    }

    this.loadingLectura = true;
    this.lecturaAsistencia = null;
    this.idareavisita = null;
    try {
      const lectura = await firstValueFrom(this.service.resolverAsistencia({
        idorg: this.idorg,
        idsesionautogestion: this.sesion.idsesionautogestion,
        codigo,
      }));
      this.lecturaAsistencia = lectura;

      if (this.requiereSeleccionAreaAsistencia) {
        return;
      }

      await this.registrarAsistencia();
    } catch (error: any) {
      await this.showToast(error?.error?.message || error?.message || 'No fue posible validar la credencial.', 'danger');
    } finally {
      this.loadingLectura = false;
    }
  }

  async registrarAsistencia(): Promise<void> {
    if (!this.sesion?.idsesionautogestion) {
      return;
    }

    if (this.requiereSeleccionAreaAsistencia && !this.idareavisita) {
      await this.showToast('Selecciona el area a visitar.', 'warning');
      return;
    }

    this.saving = true;
    try {
      const registro = await firstValueFrom(this.service.registrarAsistencia({
        idorg: this.idorg,
        idsesionautogestion: this.sesion.idsesionautogestion,
        codigo: this.codigo.trim(),
        codigoLeido: this.codigo.trim(),
        idareavisita: this.idareavisita,
        idmedioIdentificacion: this.idmedioIdentificacionActual,
      }));
      if (registro.duplicado) {
        await this.showToast(`Lectura ya registrada. Espera ${registro.segundosRestantes ?? registro.ventanaAntiduplicadoSeg ?? 60} segundo(s).`, 'warning');
        this.limpiarLectura();
        return;
      }
      await this.emitirConfirmacionLectura();
      void this.hablar(registro.tipoMovimiento === 'SALIDA' ? 'Gracias por su asistencia.' : 'Bienvenido al colegio.');
      await this.showToast(
        registro.tipoMovimiento === 'SALIDA' ? 'Gracias por su asistencia.' : 'Bienvenido al colegio.',
        'success'
      );
      setTimeout(() => {
        this.zone.run(() => this.limpiarLectura());
        void this.asegurarNfcOperativo();
      }, 4000);
    } catch (error: any) {
      await this.showToast(error?.error?.message || error?.message || 'No fue posible registrar la asistencia.', 'danger');
    } finally {
      this.saving = false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async beep(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Haptics may be unavailable on web.
    }
  }

  private iniciarReloj(): void {
    this.detenerReloj();
    this.relojActual = new Date();
    this.relojTimer = setInterval(() => {
      this.zone.run(() => {
        this.relojActual = new Date();
      });
    }, 1000);
  }

  private detenerReloj(): void {
    if (this.relojTimer) {
      clearInterval(this.relojTimer);
      this.relojTimer = null;
    }
  }

  private async hablar(texto: string): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await SeclifeTextToSpeech.speak({ text: texto });
        return;
      }

      if (!('speechSynthesis' in window)) {
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'es-MX';
      utterance.rate = 0.96;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } catch {
      // La voz es auxiliar; el registro no debe depender del parlante.
    }
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' | 'medium' = 'medium'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2300,
      color,
      position: 'top',
    });
    await toast.present();
  }
}
