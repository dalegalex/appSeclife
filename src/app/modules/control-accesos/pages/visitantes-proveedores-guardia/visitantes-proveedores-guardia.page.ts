import { Component, NgZone, OnDestroy } from '@angular/core';
import {
  CapacitorBarcodeScannerCameraDirection,
  CapacitorBarcodeScannerScanOrientation,
  CapacitorBarcodeScannerTypeHint,
} from '@capacitor/barcode-scanner';
import { Capacitor } from '@capacitor/core';
import { CapacitorNfc, NfcEvent, NdefRecord, PluginListenerHandle } from '@capgo/capacitor-nfc';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { scanQrCode } from '../../../../core/qr-scanner';
import { VisitanteProveedorPase } from '../../models/visitantes-proveedores.model';
import { VisitantesProveedoresService } from '../../services/visitantes-proveedores.service';

type ModoVisitanteProveedor = 'ENTRADA' | 'SALIDA';
type LecturaNfcDestino = 'GAFETE';

@Component({
  selector: 'app-visitantes-proveedores-guardia',
  templateUrl: './visitantes-proveedores-guardia.page.html',
  styleUrls: ['./visitantes-proveedores-guardia.page.scss'],
  standalone: false,
})
export class VisitantesProveedoresGuardiaPage implements OnDestroy {
  modo: ModoVisitanteProveedor = 'ENTRADA';
  codigoPase = '';
  codigoGafete = '';
  gafeteValidado: VisitanteProveedorPase | null = null;
  comentarios = '';
  pase: VisitanteProveedorPase | null = null;
  resultado: VisitanteProveedorPase | null = null;
  loading = false;
  saving = false;
  nfcActivo = false;
  nfcDestino: LecturaNfcDestino | null = null;
  private nfcListener: PluginListenerHandle | null = null;
  private nfcProcesando = false;
  private ultimoCodigoNfc: string | null = null;
  private ultimaLecturaNfcAt = 0;
  private audioContext: AudioContext | null = null;

  constructor(
    private readonly visitantesService: VisitantesProveedoresService,
    private readonly authService: AuthService,
    private readonly toastController: ToastController,
    private readonly zone: NgZone
  ) {}

  get idorg(): number {
    return this.authService.getCurrentUser()?.idorg ?? 0;
  }

  get puedeAutorizarEntrada(): boolean {
    return this.pasePuedeAutorizarEntrada && !!this.codigoGafete.trim() && !this.saving;
  }

  get puedeRegistrarSalida(): boolean {
    return !!this.codigoGafete.trim() && !this.saving;
  }

  get etiquetaGafete(): string {
    return this.gafeteValidado?.etiquetaGafete?.trim()
      || this.gafeteValidado?.codigoGafete?.trim()
      || this.codigoGafete.trim();
  }

  get paseEstatus(): string {
    return this.pase?.estatus?.trim().toUpperCase() || '';
  }

  get pasePuedeAutorizarEntrada(): boolean {
    return !!this.pase?.idvisitaregistro && ['PENDIENTE', 'AUTORIZADO'].includes(this.paseEstatus);
  }

  get paseYaTieneEntrada(): boolean {
    return this.paseEstatus === 'DENTRO';
  }

  get paseYaFueUtilizado(): boolean {
    return this.paseEstatus === 'SALIDA';
  }

  get paseMensajeBloqueo(): string {
    if (this.paseYaTieneEntrada) {
      return 'Este pase ya cuenta con registro de entrada. No se debe asociar otro gafete.';
    }

    if (this.paseYaFueUtilizado) {
      return 'Este codigo ya no es valido porque ya fue utilizado y tiene registro de salida.';
    }

    if (this.pase && !this.pasePuedeAutorizarEntrada) {
      return 'Este pase no esta disponible para registrar entrada.';
    }

    return '';
  }

  ngOnDestroy(): void {
    void this.detenerLecturaNfc(false);
  }

  ionViewWillLeave(): void {
    void this.detenerLecturaNfc(false);
  }

  cambiarModo(modo: ModoVisitanteProveedor): void {
    this.modo = modo;
    this.limpiar();
  }

  async activarNfc(destino: LecturaNfcDestino): Promise<void> {
    if (this.loading || this.saving) {
      return;
    }

    if (this.nfcActivo && this.nfcDestino === destino) {
      await this.detenerLecturaNfc();
      await this.showToast('Lectura NFC detenida.', 'medium');
      return;
    }

    if (!Capacitor.isNativePlatform()) {
      await this.showToast('NFC solo esta disponible en dispositivo fisico.', 'warning');
      return;
    }

    try {
      const { supported } = await CapacitorNfc.isSupported();
      if (!supported) {
        await this.showToast('Este dispositivo no cuenta con NFC.', 'warning');
        return;
      }

      const { status } = await CapacitorNfc.getStatus();
      if (status === 'NFC_DISABLED') {
        await this.showToast('Activa NFC en el dispositivo para leer gafetes fisicos.', 'warning');
        return;
      }

      await this.detenerLecturaNfc(false);
      this.nfcDestino = destino;
      await this.instalarListenerNfc();
      await this.iniciarEscaneoNfc();
      this.nfcActivo = true;
      await this.showToast('NFC listo para leer gafete.', 'medium');
    } catch {
      await this.detenerLecturaNfc(false);
      await this.showToast('No fue posible activar la lectura NFC.', 'danger');
    }
  }

  limpiarGafeteValidado(): void {
    this.gafeteValidado = null;
  }

  resolverPase(): void {
    const codigo = this.codigoPase.trim();
    if (!codigo) {
      void this.showToast('Captura o lee el codigo QR del pase.', 'warning');
      return;
    }

    this.loading = true;
    this.resultado = null;
    this.codigoGafete = '';
    this.gafeteValidado = null;
    this.visitantesService.resolverPase(codigo, this.idorg).subscribe({
      next: async (pase) => {
        this.loading = false;
        this.pase = pase;
        if (this.paseYaTieneEntrada) {
          await this.showToast('El visitante ya tiene registro de entrada.', 'warning');
          return;
        }

        if (this.paseYaFueUtilizado) {
          await this.showToast('El codigo ya no es valido porque fue utilizado.', 'danger');
          return;
        }

        if (!this.pasePuedeAutorizarEntrada) {
          await this.showToast('Este pase no esta disponible para registrar entrada.', 'warning');
          return;
        }

        await this.showToast('Pase validado correctamente.', 'success');
      },
      error: async (error) => {
        this.loading = false;
        this.pase = null;
        await this.showToast(error?.error?.message || error?.message || 'No fue posible validar el pase.', 'danger');
      },
    });
  }

  async registrarEntrada(): Promise<void> {
    if (!this.pase?.idvisitaregistro) {
      void this.showToast('Primero valida el pase del visitante/proveedor.', 'warning');
      return;
    }

    if (!this.pasePuedeAutorizarEntrada) {
      void this.showToast(this.paseMensajeBloqueo || 'Este pase no esta disponible para registrar entrada.', 'warning');
      return;
    }

    const codigoGafete = this.codigoGafete.trim();
    if (!codigoGafete) {
      void this.showToast('Captura o lee el gafete que se va a asociar.', 'warning');
      return;
    }

    if (this.esMismoCodigoPaseYGafete(codigoGafete)) {
      void this.showToast('El codigo del pase no puede usarse como gafete. Lee el TAG fisico del gafete.', 'warning');
      return;
    }

    const gafeteValido = await this.validarGafete(codigoGafete);
    if (!gafeteValido) {
      return;
    }

    this.saving = true;
    this.visitantesService.autorizarEntrada(this.pase.idvisitaregistro, {
      idorg: this.idorg,
      idtagGafete: this.gafeteValidado?.idtagGafete ?? null,
      codigoGafete,
      fechaHoraEvento: new Date().toISOString(),
      idmedioIdentificacion: 4,
      comentarios: this.comentarios.trim() || null,
    }).subscribe({
      next: async (resultado) => {
        this.saving = false;
        this.resultado = resultado;
        await this.showToast('Entrada registrada y gafete asociado.', 'success');
      },
      error: async (error) => {
        this.saving = false;
        await this.showToast(error?.error?.message || error?.message || 'No fue posible registrar la entrada.', 'danger');
      },
    });
  }

  async registrarSalida(): Promise<void> {
    const codigoGafete = this.codigoGafete.trim();
    if (!codigoGafete) {
      void this.showToast('Captura o lee el gafete a liberar.', 'warning');
      return;
    }

    const gafeteValido = await this.validarGafete(codigoGafete);
    if (!gafeteValido) {
      return;
    }

    this.saving = true;
    this.visitantesService.registrarSalida({
      idorg: this.idorg,
      idtagGafete: this.gafeteValidado?.idtagGafete ?? null,
      codigoGafete,
      fechaHoraEvento: new Date().toISOString(),
      idmedioIdentificacion: 4,
      comentarios: this.comentarios.trim() || null,
    }).subscribe({
      next: async (resultado) => {
        this.saving = false;
        this.resultado = resultado;
        this.pase = resultado;
        this.gafeteValidado = resultado;
        await this.showToast('Salida registrada y gafete liberado.', 'success');
      },
      error: async (error) => {
        this.saving = false;
        await this.showToast(error?.error?.message || error?.message || 'No fue posible registrar la salida.', 'danger');
      },
    });
  }

  async leerQrPase(): Promise<void> {
    const codigo = await this.scanQr();
    if (!codigo) {
      return;
    }

    this.codigoPase = codigo;
    this.resolverPase();
  }

  async leerQrGafete(): Promise<void> {
    const codigo = await this.scanQr();
    if (!codigo) {
      return;
    }

    this.codigoGafete = codigo;
    await this.validarGafete(codigo);
  }

  limpiar(): void {
    this.codigoPase = '';
    this.codigoGafete = '';
    this.gafeteValidado = null;
    this.comentarios = '';
    this.pase = null;
    this.resultado = null;
    this.loading = false;
    this.saving = false;
  }

  logoSrc(pase: VisitanteProveedorPase | null): string | null {
    const foto = pase?.foto?.trim();
    if (!foto) {
      return null;
    }

    return foto.startsWith('data:image') ? foto : `data:image/jpeg;base64,${foto}`;
  }

  private async scanQr(): Promise<string | null> {
    try {
      const result = await scanQrCode({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        scanInstructions: 'Alinea el codigo QR dentro del recuadro',
        cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
        scanOrientation: CapacitorBarcodeScannerScanOrientation.ADAPTIVE,
      });

      return result.ScanResult?.trim() || null;
    } catch (error: any) {
      await this.showToast(error?.message || 'No fue posible leer el codigo QR.', 'danger');
      return null;
    } finally {
      await this.reactivarNfcDespuesDeQr();
    }
  }

  private async procesarLecturaNfc(event: NfcEvent): Promise<void> {
    if (this.nfcProcesando || this.loading || this.saving) {
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
    void this.emitirBeep();

    try {
      this.codigoGafete = codigoLeido;
      await this.validarGafete(codigoLeido);
    } finally {
      this.nfcProcesando = false;
      if (this.nfcActivo) {
        await this.delay(650);
        await this.reiniciarEscaneoNfc();
      }
    }
  }

  private async validarGafete(codigo: string): Promise<boolean> {
    const codigoLimpio = codigo.trim();
    if (!codigoLimpio) {
      this.gafeteValidado = null;
      return false;
    }

    if (this.esMismoCodigoPaseYGafete(codigoLimpio)) {
      this.gafeteValidado = null;
      await this.showToast('El codigo del pase no puede usarse como gafete. Lee el TAG fisico del gafete.', 'warning');
      return false;
    }

    if (this.gafeteValidado?.codigoGafete === codigoLimpio) {
      const mensajeTipo = this.validarTipoGafete(this.gafeteValidado);
      if (mensajeTipo) {
        this.gafeteValidado = null;
        await this.showToast(mensajeTipo, 'warning');
        return false;
      }

      return true;
    }

    try {
      const gafete = await firstValueFrom(this.visitantesService.validarGafete(codigoLimpio, this.idorg));
      const mensajeTipo = this.validarTipoGafete(gafete);
      if (mensajeTipo) {
        this.gafeteValidado = null;
        await this.showToast(mensajeTipo, 'warning');
        return false;
      }

      this.gafeteValidado = gafete;
      await this.showToast(`Gafete: ${this.etiquetaGafete}`, 'success');
      return true;
    } catch (error: any) {
      this.gafeteValidado = null;
      const message = error?.status === 404
        ? 'GpsApi publicado no tiene activa la validacion de gafetes. Publica GpsApi e intenta nuevamente.'
        : (error?.error?.message || error?.message || 'Gafete no encontrado.');
      await this.showToast(message, 'danger');
      return false;
    }
  }

  private esMismoCodigoPaseYGafete(codigoGafete: string): boolean {
    const pase = this.codigoPase.trim().toUpperCase();
    const gafete = codigoGafete.trim().toUpperCase();
    return !!pase && !!gafete && pase === gafete;
  }

  private validarTipoGafete(gafete: VisitanteProveedorPase): string | null {
    const tipo = this.pase?.tipoVisitante?.trim().toUpperCase();
    const idperfil = gafete.idperfil ?? null;

    if (tipo === 'VISITANTE' && idperfil !== 6) {
      return 'El gafete no corresponde a visitante.';
    }

    if (tipo === 'PROVEEDOR' && idperfil !== 7) {
      return 'El gafete no corresponde a proveedor.';
    }

    return null;
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

  private async reiniciarEscaneoNfc(): Promise<void> {
    try {
      await CapacitorNfc.stopScanning();
    } catch {
      // Puede no haber una sesion activa despues de una lectura.
    }

    try {
      await this.instalarListenerNfc();
      await this.delay(250);
      await this.iniciarEscaneoNfc();
      this.nfcActivo = true;
    } catch {
      this.nfcActivo = false;
      this.nfcDestino = null;
      await this.showToast('La lectura NFC se detuvo. Activa NFC nuevamente.', 'warning');
    }
  }

  private async instalarListenerNfc(): Promise<void> {
    if (this.nfcListener) {
      return;
    }

    this.nfcListener = await CapacitorNfc.addListener('nfcEvent', (event: NfcEvent) => {
      this.zone.run(() => {
        void this.procesarLecturaNfc(event);
      });
    });
  }

  private async reactivarNfcDespuesDeQr(): Promise<void> {
    if (!this.nfcActivo || !this.nfcDestino || !Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await this.instalarListenerNfc();
      await this.delay(650);
      await this.reiniciarEscaneoNfc();
    } catch {
      this.nfcActivo = false;
      this.nfcDestino = null;
      await this.showToast('La lectura NFC se detuvo. Activa NFC nuevamente.', 'warning');
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
      this.nfcDestino = null;
    }
  }

  private async emitirBeep(): Promise<void> {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        return;
      }

      this.audioContext ??= new AudioContextClass();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
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
      // El beep es auxiliar; no debe bloquear la lectura.
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' | 'medium' = 'success'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2600,
      color,
      position: 'top',
    });
    await toast.present();
  }
}
