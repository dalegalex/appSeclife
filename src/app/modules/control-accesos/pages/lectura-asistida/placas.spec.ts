import { EMPTY, of, throwError } from 'rxjs';
import { LecturaAsistidaPage } from './lectura-asistida.page';
import { candidatosPlaca, placaOcr } from '../../../../core/placa-ocr';

describe('Placas en entrega asistida', () => {
  let page: LecturaAsistidaPage;
  let api: any;
  let carrusel: any;
  beforeEach(() => {
    api = { registrarLectura: jasmine.createSpy().and.returnValue(EMPTY) };
    carrusel = { cierre$: EMPTY, registrarAviso: jasmine.createSpy().and.returnValue(of({ idcarrusellectura: 1, alumnos: [{}] })) };
    page = new LecturaAsistidaPage(api, carrusel, {} as any, {} as any,
      { getCurrentUser: () => ({ idorg: 1099 }) } as any, {} as any, { detectChanges: () => {} } as any);
    spyOn<any>(page, 'showToast').and.resolveTo();
    page.sentido = 'SALIDA';
    (page as any).aplicarLectura({ tipoLectura: 'FAMILIAR', sentido: 'SALIDA',
      familiar: { idfamilia: 1, idfamiliamiembro: 10 }, autos: [],
      alumnos: [{ idmatricula: 1, alumno: 'Prueba', tipoRelacion: 'FAMILIA_NUCLEO', disponible: true }] });
    page.cambiarTipoEntrega('AUTO');
  });
  it('permite placa sin catalogo y exige formato valido', () => {
    expect(page.entregaSalidaValida).toBeFalse();
    page.cambiarPlaca(' abc-123 ');
    expect(page.placaNormalizada).toBe('ABC123');
    expect(page.entregaSalidaValida).toBeFalse();
    page.confirmarPlaca();
    expect(page.entregaSalidaValida).toBeTrue();
    page.cambiarPlaca('ABC?'); expect(page.entregaSalidaValida).toBeFalse();
    page.cambiarPlaca('A'.repeat(31)); expect(page.entregaSalidaValida).toBeFalse();
  });
  it('busca por placa normalizada sin duplicar una coincidencia exacta', () => {
    page.lectura!.autos = [{ idautofamiliar: 7, idfamilia: 1, placas: 'ABC-123' }, { idautofamiliar: 8, placas: 'DEF456' }];
    page.cambiarPlaca('abc'); expect(page.autosFiltrados.length).toBe(1);
    page.cambiarPlaca('ABC 123'); expect(page.idautofamiliarSeleccionado).toBe(7);
    expect((page as any).datosPlacaEntrega().guardarAutoFamiliar).toBeFalse();
  });
  it('envia placa y familia en entrega directa', async () => {
    page.cambiarPlaca(' abc-123 ');
    page.confirmarPlaca();
    await page.registrar();
    expect(api.registrarLectura.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      placaEntrega: 'ABC123', idfamiliaVehiculo: 1, guardarAutoFamiliar: true, idautofamiliar: null, otroAuto: false
    }));
  });
  it('envia placa ocasional en aviso y limpia datos tras exito', async () => {
    page.cambiarPlaca('TAXI1'); page.guardarAutoFamiliar = false;
    page.confirmarPlaca();
    page.modoAviso = true; page.idcarruselsesionSeleccionada = 9;
    await page.registrar();
    expect(carrusel.registrarAviso.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ placaEntrega: 'TAXI1', guardarAutoFamiliar: false }));
    expect(page.placaManual).toBe(''); expect(page.lectura).toBeNull();
  });
  it('conserva captura cuando se rechaza la entrega', async () => {
    api.registrarLectura.and.returnValue(throwError(() => new Error('Rechazada')));
    page.cambiarPlaca('ABC123'); page.confirmarPlaca(); await page.registrar();
    expect(page.placaManual).toBe('ABC123'); expect(page.lectura).not.toBeNull();
    expect(page.saving).toBeFalse();
  });
  it('no envia placas al cambiar a peatonal u otro', () => {
    page.cambiarPlaca('ABC123');
    for (const modo of ['PEATONAL','OTRO_AUTO'] as const) {
      page.cambiarTipoEntrega(modo);
      expect((page as any).datosPlacaEntrega().placaEntrega).toBeNull();
    }
  });
  it('OCR mantiene el borrador hasta confirmar y no registra la entrega', async () => {
    (page as any).paginaActiva = true;
    spyOn(placaOcr, 'disponible').and.returnValue(true);
    spyOn(placaOcr, 'capturar').and.resolveTo({ imagen: 'data:image/jpeg;base64,AA', lines: ['ABC-123'] });
    page.cambiarPlaca('ANTERIOR');
    await page.capturarPlaca();
    expect(page.ocrAbierto()).toBeTrue();
    expect(page.placaManual).toBe('ANTERIOR');
    expect(page.puedeRegistrar).toBeFalse();
    page.ocrPlaca.set('ABC 124');
    await page.aceptarPlacaOcr();
    expect(page.placaManual).toBe('ABC124');
    expect(page.placaConfirmada).toBeTrue();
    expect(page.ocrImagen()).toBe('');
    expect(api.registrarLectura).not.toHaveBeenCalled();
  });
  it('OCR cancelado conserva placa y restaura NFC encendido', async () => {
    (page as any).paginaActiva = true;
    page.nfcActivo = true;
    spyOn<any>(page, 'detenerLecturaNfc').and.resolveTo();
    const restore = spyOn<any>(page, 'restaurarNfcDespuesQr').and.resolveTo();
    spyOn(placaOcr, 'disponible').and.returnValue(true);
    spyOn(placaOcr, 'capturar').and.rejectWith(new Error('User cancelled photos app'));
    page.cambiarPlaca('PREV123');
    await page.capturarPlaca();
    expect(page.placaManual).toBe('PREV123');
    expect(page.ocrOcupado).toBeFalse();
    expect(restore).toHaveBeenCalledTimes(1);
  });
  it('OCR sin resultados permite correccion y respeta NFC apagado', async () => {
    (page as any).paginaActiva = true;
    (page as any).nfcHabilitadoPorUsuario = false;
    const restore = spyOn<any>(page, 'restaurarNfcDespuesQr').and.resolveTo();
    spyOn(placaOcr, 'disponible').and.returnValue(true);
    spyOn(placaOcr, 'capturar').and.resolveTo({ imagen: 'data:image/jpeg;base64,AA', lines: [] });
    await page.capturarPlaca();
    expect(page.ocrPlacaValida).toBeFalse();
    await page.cerrarOcr();
    expect(restore).not.toHaveBeenCalled();
  });
  it('OCR descarta resultado si cambia la familia durante la captura', async () => {
    (page as any).paginaActiva = true;
    spyOn(placaOcr, 'disponible').and.returnValue(true);
    let complete!: (value: { imagen: string; lines: string[] }) => void;
    spyOn(placaOcr, 'capturar').and.returnValue(new Promise(resolve => complete = resolve));
    const pending = page.capturarPlaca();
    (page as any).resetLectura();
    complete({ imagen: 'data:image/jpeg;base64,AA', lines: ['ABC123'] });
    await pending;
    expect(page.ocrAbierto()).toBeFalse();
    expect(page.placaManual).toBe('');
  });
  it('OCR reutiliza un auto solo despues de confirmacion', async () => {
    (page as any).paginaActiva = true;
    page.lectura!.autos = [{ idautofamiliar: 7, idfamilia: 1, placas: 'ABC-123' }];
    spyOn(placaOcr, 'disponible').and.returnValue(true);
    spyOn(placaOcr, 'capturar').and.resolveTo({ imagen: 'data:image/jpeg;base64,AA', lines: ['ABC123'] });
    await page.capturarPlaca();
    expect(page.idautofamiliarSeleccionado).toBeNull();
    await page.aceptarPlacaOcr();
    expect(page.idautofamiliarSeleccionado).toBe(7);
    expect((page as any).datosPlacaEntrega().guardarAutoFamiliar).toBeFalse();
  });
  it('OCR no disponible mantiene captura manual', async () => {
    spyOn(placaOcr, 'disponible').and.returnValue(false);
    const capture = spyOn(placaOcr, 'capturar');
    page.cambiarPlaca('ABC123');
    await page.capturarPlaca();
    expect(capture).not.toHaveBeenCalled();
    expect(page.placaManual).toBe('ABC123');
  });
});

describe('Candidatos OCR de placas', () => {
  it('normaliza, deduplica y prioriza catalogo sin corregir caracteres ambiguos', () => {
    expect(candidatosPlaca(['MEXICO', 'XYZ 789', 'ABC-123', 'ABC123', 'OBI-018'], ['ABC123']))
      .toEqual(['ABC123', 'XYZ789', 'OBI018']);
  });
  it('no combina textos de lineas distintas ni admite signos desconocidos', () => {
    expect(candidatosPlaca(['ABC', '1234', 'ABC?123', 'ESTADO DE MEXICO', '12345678901234567890']))
      .toEqual(['1234']);
  });
  it('admite placas conocidas de solo letras', () => {
    expect(candidatosPlaca(['ABCDEF'], ['ABCDEF'])).toEqual(['ABCDEF']);
  });
});
