import { Capacitor, registerPlugin } from '@capacitor/core';
import { Camera, CameraDirection, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem } from '@capacitor/filesystem';

interface PlacaOcrPlugin {
  recognize(options: { base64: string }): Promise<{ lines: string[] }>;
}
const nativeOcr = registerPlugin<PlacaOcrPlugin>('SeclifePlacaOcr');

export function candidatosPlaca(lines: string[], conocidas: string[] = []): string[] {
  const normalizar = (s: string) => s.toUpperCase().replace(/[\s-]/g, '');
  const catalogo = new Set(conocidas.map(normalizar));
  const candidatos = new Set<string>();
  // No intercambia O/0, I/1 o B/8: cualquier correccion pertenece al operador.
  for (const line of lines.slice(0, 100)) {
    const value = normalizar(line);
    if (/^[A-Z0-9]{3,12}$/.test(value) && (/[0-9]/.test(value) || catalogo.has(value))) {
      candidatos.add(value);
    }
  }
  const mixta = (s: string) => /[A-Z]/.test(s) && /[0-9]/.test(s);
  return [...candidatos].sort((a, b) => Number(catalogo.has(b)) - Number(catalogo.has(a))
    || Number(mixta(b)) - Number(mixta(a))).slice(0, 12);
}

export const placaOcr = {
  disponible: () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SeclifePlacaOcr'),
  async capturar(): Promise<{ imagen: string; lines: string[] }> {
    if (!this.disponible()) throw new Error('OCR_NO_DISPONIBLE');
    const photo = await Camera.getPhoto({
      source: CameraSource.Camera, direction: CameraDirection.Rear,
      resultType: CameraResultType.Uri, quality: 90, width: 1600, height: 1600,
      correctOrientation: true, saveToGallery: false, allowEditing: false,
    });
    if (!photo.path) throw new Error('OCR_SIN_IMAGEN');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const file = await Filesystem.readFile({ path: photo.path });
      if (typeof file.data !== 'string' || file.data.length > 8_000_000) throw new Error('OCR_IMAGEN_INVALIDA');
      const result = await Promise.race([
        nativeOcr.recognize({ base64: file.data }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('OCR_TIEMPO')), 20000); }),
      ]);
      return { imagen: `data:image/jpeg;base64,${file.data}`, lines: result.lines ?? [] };
    } finally {
      clearTimeout(timer);
      // Solo el archivo temporal devuelto por esta captura; nunca fotos del catalogo.
      await Filesystem.deleteFile({ path: photo.path }).catch(() => undefined);
    }
  },
};
