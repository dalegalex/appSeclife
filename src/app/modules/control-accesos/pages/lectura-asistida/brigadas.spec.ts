import { EMPTY } from 'rxjs';
import { LecturaAsistidaPage } from './lectura-asistida.page';
import { LecturaAsistidaAlumno } from '../../models/lectura-asistida.model';

describe('Lectura asistida: brigadas', () => {
  let page: LecturaAsistidaPage;
  let api: any;
  let alert: any;
  const alumno = (idmatricula: number, tipoRelacion: string, brigada = false): LecturaAsistidaAlumno => ({
    idmatricula, alumno: `Alumno ${idmatricula}`, tipoRelacion, disponible: true,
    brigada: brigada ? { idbrigada: 7, idfamiliamiembro: 20, etiqueta: 'RONDA',
      familiaResponsable: 'Familia A', tipoRecogida: 'ALTERNATIVA', revisionAviso: 'revision', advertencias: [] } : null,
  });
  beforeEach(() => {
    api = { registrarLectura: jasmine.createSpy().and.returnValue(EMPTY) };
    alert = { create: jasmine.createSpy().and.resolveTo({ present: async () => {}, onDidDismiss: async () => ({ role: 'cancel' }) }) };
    page = new LecturaAsistidaPage(api, { cierre$: EMPTY } as any, {} as any, alert,
      { getCurrentUser: () => ({ idorg: 1011 }) } as any, {} as any, { detectChanges: () => {} } as any);
    spyOn<any>(page, 'showToast').and.resolveTo();
    page.sentido = 'SALIDA';
    page.codigo = '123456';
    (page as any).aplicarLectura({ tipoLectura: 'FAMILIAR', sentido: 'SALIDA', familiar: { idfamiliamiembro: 20 },
      alumnos: [alumno(3, 'COMPARTIDO'), alumno(2, 'BRIGADA_SEMANAL', true), alumno(1, 'FAMILIA_NUCLEO')] });
  });
  it('ordena nucleo, brigada y otros, seleccionando solo nucleo', () => {
    expect(page.alumnos.map(a => a.idmatricula)).toEqual([1, 2, 3]);
    expect([...page.seleccion]).toEqual([1]);
    expect(page.alumnoRelacionLabel(page.alumnos[1])).toBe('BRIGADA');
  });
  it('no selecciona alumnos entregados', () => {
    const entregado = { ...page.alumnos[1], disponible: false, yaTieneSentidoHoy: true, estatusSalida: 'REGISTRO_SALIDA' };
    page.toggleAlumno(entregado, true);
    expect(page.seleccion.has(2)).toBeFalse();
  });
  it('envia identidad de brigada al registrar', async () => {
    page.seleccion = new Set([2]);
    page.tipoEntrega = 'PEATONAL';
    await page.registrar();
    expect(api.registrarLectura.calls.mostRecent().args[0].alumnos[0]).toEqual(jasmine.objectContaining({
      idmatricula: 2, idbrigada: 7, revisionAviso: 'revision', confirmarEntregaAlterna: false,
    }));
  });
  it('cancelar advertencia no envia entrega', async () => {
    page.alumnos[1].brigada!.advertencias = [{ persona: 'Otra persona', familia: 'Familia B', origen: 'INVITADO' }];
    page.seleccion = new Set([2]);
    page.tipoEntrega = 'PEATONAL';
    await page.registrar();
    expect(alert.create).toHaveBeenCalled();
    expect(api.registrarLectura).not.toHaveBeenCalled();
    expect(page.saving).toBeFalse();
  });
});
