import { Component, NgZone, OnDestroy, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { CapacitorNfc, NdefRecord, NfcEvent, PluginListenerHandle } from '@capgo/capacitor-nfc';
import {
  ActionSheetController,
  AlertController,
  InfiniteScrollCustomEvent,
  LoadingController,
  ToastController,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { PerfilEnrolamiento, SujetoEnrolamiento } from '../../models/enrolamiento-credenciales.model';
import { EnrolamientoCredencialesService } from '../../services/enrolamiento-credenciales.service';

interface FotoNormalizada {
  base64: string;
  contentType: string;
  width: number;
  height: number;
  fileName: string;
}

@Component({
  selector: 'app-enrolamiento-credenciales',
  templateUrl: './enrolamiento-credenciales.page.html',
  styleUrls: ['./enrolamiento-credenciales.page.scss'],
  standalone: false,
})
export class EnrolamientoCredencialesPage implements OnDestroy {
  private readonly route = '/control-accesos/enrolamiento';
  private readonly pageSize = 20;
  private nfcListener: PluginListenerHandle | null = null;

  readonly perfil = signal<PerfilEnrolamiento>(5);
  readonly searchText = signal('');
  readonly sujetos = signal<SujetoEnrolamiento[]>([]);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(true);
  readonly fotoModalAbierto = signal(false);
  readonly fotoModalCargando = signal(false);
  readonly fotoModalUrl = signal<string | null>(null);
  readonly fotoModalError = signal<string | null>(null);
  readonly fotoModalSujeto = signal<SujetoEnrolamiento | null>(null);
  readonly nfcEsperandoSubjectKey = signal<string | null>(null);
  readonly idorg = computed(() => Number(this.authService.user()?.idorg ?? 0));
  readonly tituloPerfil = computed(() => ({ 5: 'Alumnos', 4: 'Familiares', 1: 'Personal' })[this.perfil()]);

  constructor(
    private readonly authService: AuthService,
    private readonly service: EnrolamientoCredencialesService,
    private readonly router: Router,
    private readonly actionSheetController: ActionSheetController,
    private readonly alertController: AlertController,
    private readonly loadingController: LoadingController,
    private readonly toastController: ToastController,
    private readonly zone: NgZone
  ) {}

  async ionViewWillEnter(): Promise<void> {
    await firstValueFrom(this.authService.loadAppMenu(true));
    if (!this.authService.canExecuteAppRoute(this.route) || !this.idorg()) {
      await this.toast('No tienes permiso para enrolar fotografias o credenciales.', 'danger');
      await this.router.navigateByUrl('/home');
      return;
    }
    await this.consultar(true);
  }

  onSearchInput(event: Event): void {
    const value = (event as CustomEvent<{ value?: string | null }>).detail?.value ?? '';
    this.searchText.set(value);
  }

  async seleccionarPerfil(value: string | number | undefined): Promise<void> {
    const perfil = Number(value) as PerfilEnrolamiento;
    if (![1, 4, 5].includes(perfil) || perfil === this.perfil()) return;
    this.perfil.set(perfil);
    this.searchText.set('');
    await this.consultar(true);
  }

  async buscar(): Promise<void> {
    await this.consultar(true);
  }

  async cargarMas(event: InfiniteScrollCustomEvent): Promise<void> {
    if (!this.hasMore() || this.loadingMore()) {
      await event.target.complete();
      return;
    }
    await this.consultar(false);
    await event.target.complete();
  }

  async verFoto(sujeto: SujetoEnrolamiento): Promise<void> {
    if (!sujeto.tieneFoto) return;

    this.fotoModalSujeto.set(sujeto);
    this.fotoModalUrl.set(null);
    this.fotoModalError.set(null);
    this.fotoModalCargando.set(true);
    this.fotoModalAbierto.set(true);

    try {
      const foto = await firstValueFrom(this.service.consultarFoto({
        idorg: this.idorg(),
        idperfil: sujeto.idperfilCredencial,
        idusrbtMiembro: sujeto.idusrbt,
        idmatricula: sujeto.idmatricula,
        subjectKey: sujeto.subjectKey,
      }));
      const source = foto?.fotoUrl?.trim();
      if (!source) throw new Error('No se encontro la fotografia vigente.');
      this.fotoModalUrl.set(/^data:image\//i.test(source)
        ? source
        : `data:${foto?.fotoContentType || 'image/jpeg'};base64,${source}`);
    } catch (error) {
      this.fotoModalError.set(this.errorMessage(error, 'No fue posible cargar la fotografia.'));
    } finally {
      this.fotoModalCargando.set(false);
    }
  }

  cerrarFoto(): void {
    this.fotoModalAbierto.set(false);
    this.fotoModalCargando.set(false);
    this.fotoModalUrl.set(null);
    this.fotoModalError.set(null);
    this.fotoModalSujeto.set(null);
  }

  async elegirFoto(sujeto: SujetoEnrolamiento, sliding?: { close: () => Promise<void> }): Promise<void> {
    await sliding?.close();
    const sheet = await this.actionSheetController.create({
      header: sujeto.displayName,
      buttons: [
        { text: 'Tomar fotografia', icon: 'camera-outline', handler: () => void this.capturarFoto(sujeto, CameraSource.Camera) },
        { text: 'Elegir de galeria', icon: 'images-outline', handler: () => void this.capturarFoto(sujeto, CameraSource.Photos) },
        { text: 'Cancelar', icon: 'close-outline', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  async leerTag(sujeto: SujetoEnrolamiento, sliding?: { close: () => Promise<void> }): Promise<void> {
    await sliding?.close();
    if (!Capacitor.isNativePlatform()) {
      await this.toast('La lectura NFC requiere la aplicacion instalada en Android o iOS.', 'warning');
      return;
    }
    if (this.nfcEsperandoSubjectKey()) {
      await this.toast('Ya hay una lectura NFC en espera.', 'warning');
      return;
    }

    this.nfcEsperandoSubjectKey.set(sujeto.subjectKey);
    try {
      const codigoNfc = (await this.esperarLecturaNfc()).trim().toUpperCase();
      this.nfcEsperandoSubjectKey.set(null);
      await this.detenerNfc();
      const actual = this.mascaraCodigo(sujeto.codigo);
      const nuevo = this.mascaraCodigo(codigoNfc);
      const alert = await this.alertController.create({
        header: sujeto.tieneTag ? 'Sustituir credencial NFC' : 'Asignar credencial NFC',
        message: sujeto.tieneTag
          ? `La credencial ${actual} quedara bloqueada y se asignara ${nuevo}.`
          : `Se asignara la credencial ${nuevo} a ${sujeto.displayName}.`,
        inputs: [{ name: 'motivo', type: 'text', placeholder: 'Motivo u observacion', value: 'ENROLAMIENTO MOVIL' }],
        buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Confirmar', role: 'confirm' }],
      });
      await alert.present();
      const result = await alert.onDidDismiss<{ values?: { motivo?: string } }>();
      if (result.role !== 'confirm') return;

      const loading = await this.loadingController.create({ message: 'Registrando credencial NFC...' });
      await loading.present();
      try {
        const response = await firstValueFrom(this.service.rotarTag({
          idorg: this.idorg(),
          idperfil: sujeto.idperfilCredencial,
          idmatricula: sujeto.idmatricula,
          idusrbtSujeto: sujeto.idusrbt,
          subjectKey: sujeto.subjectKey,
          codigoNfc,
          motivo: result.data?.values?.motivo?.trim() || 'ENROLAMIENTO MOVIL',
        }));
        await this.verificarTagPersistido(sujeto, response.idtagNuevo, codigoNfc);
        await this.toast(
          response.accion === 'SIN_CAMBIO'
            ? 'El TAG ya tenia asignado este codigo NFC.'
            : 'Codigo NFC actualizado sobre el TAG existente.',
          'success'
        );
      } finally {
        await loading.dismiss();
      }
    } catch (error) {
      await this.toast(this.errorMessage(error, 'No fue posible registrar la credencial NFC.'), 'danger');
    } finally {
      if (this.nfcEsperandoSubjectKey() === sujeto.subjectKey) {
        this.nfcEsperandoSubjectKey.set(null);
      }
      await this.detenerNfc();
    }
  }

  identificador(sujeto: SujetoEnrolamiento): string {
    if (sujeto.idperfilCredencial === 5) return sujeto.matricula ? `Matricula ${sujeto.matricula}` : `Alumno ${sujeto.idmatricula}`;
    if (sujeto.idperfilCredencial === 1) return sujeto.numeroEmpleado ? `Empleado ${sujeto.numeroEmpleado}` : (sujeto.cargo || 'Personal del Colegio');
    return sujeto.familia || 'Familiar';
  }

  contexto(sujeto: SujetoEnrolamiento): string {
    return [sujeto.contexto, sujeto.unidadAdministrativa].filter(Boolean).join(' | ');
  }

  mascaraCodigo(value?: string | null): string {
    const code = value?.trim();
    return code ? `***${code.slice(-4)}` : 'sin TAG';
  }

  ngOnDestroy(): void {
    void this.detenerNfc();
  }

  private async consultar(reset: boolean): Promise<void> {
    if (this.loading() || this.loadingMore()) return;
    reset ? this.loading.set(true) : this.loadingMore.set(true);
    try {
      const current = reset ? [] : this.sujetos();
      const page = await firstValueFrom(this.service.consultarSujetos({
        idorg: this.idorg(), idperfil: this.perfil(), searchText: this.searchText(), topi: current.length,
      }));
      this.sujetos.set([...current, ...page]);
      this.hasMore.set(page.length === this.pageSize);
    } catch (error) {
      await this.toast(this.errorMessage(error, 'No fue posible consultar los registros.'), 'danger');
      if (reset) this.sujetos.set([]);
    } finally {
      this.loading.set(false);
      this.loadingMore.set(false);
    }
  }

  private async verificarTagPersistido(
    sujeto: SujetoEnrolamiento,
    idtagEsperado: number,
    codigoEsperado: string
  ): Promise<void> {
    const searchText = sujeto.idperfilCredencial === 5
      ? (sujeto.matricula?.trim() || sujeto.displayName)
      : sujeto.displayName;
    const resultados = await firstValueFrom(this.service.consultarSujetos({
      idorg: this.idorg(),
      idperfil: this.perfil(),
      searchText,
      topi: 0,
    }));
    const persistido = resultados.find(item => item.subjectKey === sujeto.subjectKey);
    const codigoCoincide = persistido?.codigo?.trim().toUpperCase() === codigoEsperado.trim().toUpperCase();
    if (!persistido || persistido.idtag !== idtagEsperado || !codigoCoincide) {
      throw new Error('El servidor no confirmo la persistencia de la credencial NFC. Recarga e intenta nuevamente.');
    }
    this.actualizarSujeto(sujeto.subjectKey, persistido);
  }

  private async capturarFoto(sujeto: SujetoEnrolamiento, source: CameraSource): Promise<void> {
    try {
      const photo = await Camera.getPhoto({
        source, resultType: CameraResultType.DataUrl, quality: 90, width: 1600, height: 1600,
        correctOrientation: true, saveToGallery: false, allowEditing: false,
      });
      if (!photo.dataUrl) return;
      const normalized = await this.normalizarFoto(photo.dataUrl);
      const loading = await this.loadingController.create({ message: 'Guardando fotografia...' });
      await loading.present();
      try {
        await firstValueFrom(this.service.guardarFoto({
          idorg: this.idorg(), idperfil: sujeto.idperfilCredencial,
          idusrbtMiembro: sujeto.idusrbt, idmatricula: sujeto.idmatricula, subjectKey: sujeto.subjectKey,
          fotoBase64: normalized.base64, fotoContentType: normalized.contentType,
          fotoNombreArchivo: normalized.fileName, fotoAncho: normalized.width, fotoAlto: normalized.height,
          procesamientoEstado: 'SIN_PROCESAR', procesamientoMetodo: 'DISPOSITIVO',
          metadata: { fuente: source === CameraSource.Camera ? 'CAMARA' : 'GALERIA', plataforma: Capacitor.getPlatform() },
        }));
        this.actualizarSujeto(sujeto.subjectKey, { tieneFoto: true, fotoValidada: true });
        await this.toast('Fotografia registrada correctamente.', 'success');
      } finally {
        await loading.dismiss();
      }
    } catch (error) {
      const message = this.errorMessage(error, 'No fue posible guardar la fotografia.');
      if (!message.toLowerCase().includes('cancel')) await this.toast(message, 'danger');
    }
  }

  private async normalizarFoto(dataUrl: string): Promise<FotoNormalizada> {
    const image = await this.cargarImagen(dataUrl);
    const maxSide = 1200;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No fue posible procesar la fotografia.');
    context.drawImage(image, 0, 0, width, height);
    const result = canvas.toDataURL('image/jpeg', 0.86);
    const base64 = result.split(',')[1] ?? '';
    if (!base64 || base64.length > 2_800_000) throw new Error('La fotografia excede el tamano permitido de 2 MB.');
    return { base64, contentType: 'image/jpeg', width, height, fileName: `foto-${Date.now()}.jpg` };
  }

  private cargarImagen(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('La imagen seleccionada no es valida.'));
      image.src = src;
    });
  }

  private async esperarLecturaNfc(): Promise<string> {
    const { supported } = await CapacitorNfc.isSupported();
    if (!supported) throw new Error('Este dispositivo no cuenta con NFC.');
    const { status } = await CapacitorNfc.getStatus();
    if (status === 'NFC_DISABLED') throw new Error('Activa NFC en el dispositivo.');
    await this.detenerNfc();

    return new Promise<string>(async (resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Tiempo agotado para leer la credencial NFC.')), 45000);
      try {
        this.nfcListener = await CapacitorNfc.addListener('nfcEvent', (event: NfcEvent) => this.zone.run(() => {
          const code = this.extraerCodigoNfc(event);
          if (!code) return;
          window.clearTimeout(timeout);
          resolve(code);
        }));
        await CapacitorNfc.startScanning({ invalidateAfterFirstRead: true, alertMessage: 'Acerca la credencial NFC al dispositivo.', iosSessionType: 'tag' });
        await this.toast('Acerca la credencial NFC al dispositivo.', 'medium');
      } catch (error) {
        window.clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private extraerCodigoNfc(event: NfcEvent): string | null {
    for (const record of event.tag?.ndefMessage ?? []) {
      const text = this.extraerTextoNdef(record);
      if (text) return text;
    }
    const uid = event.tag?.id;
    if (!uid?.length) return null;
    return [...uid].reverse().reduce((value, byte) => (value << 8n) + BigInt(byte & 0xff), 0n).toString().padStart(10, '0');
  }

  private extraerTextoNdef(record: NdefRecord): string | null {
    if (!record.payload?.length) return null;
    const type = String.fromCharCode(...record.type).toUpperCase();
    let payload = record.payload;
    if (type === 'T' && payload.length > 1) payload = payload.slice(1 + (payload[0] & 0x3f));
    else if (type === 'U' && payload.length > 1) payload = payload.slice(1);
    const code = new TextDecoder('utf-8').decode(new Uint8Array(payload)).replace(/[\u0000-\u001f\u007f]/g, '').trim();
    return code || null;
  }

  private async detenerNfc(): Promise<void> {
    await this.nfcListener?.remove();
    this.nfcListener = null;
    try { await CapacitorNfc.stopScanning(); } catch { /* No siempre existe una sesion activa. */ }
  }

  private actualizarSujeto(subjectKey: string, changes: Partial<SujetoEnrolamiento>): void {
    this.sujetos.update(items => items.map(item => item.subjectKey === subjectKey ? { ...item, ...changes } : item));
  }

  private errorMessage(error: unknown, fallback: string): string {
    const value = error as { error?: { message?: string }; message?: string };
    return value?.error?.message || value?.message || fallback;
  }

  private async toast(message: string, color: string): Promise<void> {
    const toast = await this.toastController.create({ message, color, duration: 2800, position: 'bottom' });
    await toast.present();
  }
}
