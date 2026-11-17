import { of, Subject, throwError } from 'rxjs';
import { ExpedientePreparacionComponent } from './expediente-preparacion.component';

describe('Preparacion familiar informativa', () => {
  let component: ExpedientePreparacionComponent;
  let service: jasmine.SpyObj<any>;
  const catalog = { codeNumber: 200, result: { habilitado: true, contextoResuelto: true, idfamilia: 1, familia: 'Familia prueba', idciclo: 202627, ciclo: '2026-2027' } };
  const response = { codeNumber: 200, result: { ...catalog.result, asignacionAutomatica: false, consultadoUtc: '', documentos: [] } };
  beforeEach(() => {
    service = jasmine.createSpyObj('service', ['preparacionCatalogo', 'preparacion']);
    service.preparacionCatalogo.and.returnValue(of(catalog));
    service.preparacion.and.returnValue(of(response));
    component = new ExpedientePreparacionComponent(service);
  });
  it('solo consulta catalogo al entrar, sin crear ni consultar todas las familias', async () => {
    await component.loadCatalog();
    expect(component.catalog()?.idfamilia).toBe(1);
    expect(component.catalog()?.idciclo).toBe(202627);
    expect(service.preparacion).not.toHaveBeenCalled();
  });
  it('consulta sin enviar familia ni ciclo elegidos por el cliente', async () => {
    await component.loadCatalog(); await component.review();
    expect(service.preparacion).toHaveBeenCalledOnceWith();
    expect(component.result()?.asignacionAutomatica).toBeFalse();
  });
  it('elimina resultados al volver a resolver el contexto', async () => {
    await component.loadCatalog(); await component.review(); await component.loadCatalog();
    expect(component.result()).toBeNull();
  });
  it('descarta respuestas antiguas al volver a resolver contexto', async () => {
    await component.loadCatalog();
    const pending = new Subject<any>(); service.preparacion.and.returnValue(pending);
    const task = component.review(); await component.loadCatalog();
    pending.next(response); pending.complete(); await task;
    expect(component.result()).toBeNull();
  });
  it('fallo no se interpreta como familia lista', async () => {
    await component.loadCatalog(); service.preparacion.and.returnValue(throwError(() => new Error('fallo')));
    await component.review(); expect(component.result()).toBeNull(); expect(component.error()).not.toBe('');
  });
  it('respuesta incompleta no se interpreta como sin requisitos', async () => {
    await component.loadCatalog(); service.preparacion.and.returnValue(of({ codeNumber: 200, result: { habilitado: true } }));
    await component.review(); expect(component.result()).toBeNull(); expect(component.error()).not.toBe('');
  });
  it('no consulta un contexto ambiguo o sin ciclo', async () => {
    service.preparacionCatalogo.and.returnValue(of({ codeNumber: 200, result: { habilitado: true, contextoResuelto: false, mensajeContexto: 'Revisar nucleo' } }));
    await component.loadCatalog(); await component.review(); expect(service.preparacion).not.toHaveBeenCalled();
  });
  it('cambio de contexto entre consultas no se presenta como listo', async () => {
    await component.loadCatalog();
    service.preparacion.and.returnValue(of({codeNumber: 200, result: {habilitado: true, contextoResuelto: false, mensajeContexto: 'Revisar inscripcion', documentos: []}}));
    await component.review(); expect(component.result()).toBeNull(); expect(component.catalog()?.contextoResuelto).toBeFalse();
  });
  it('ya asignado no dice firmado', () => { expect(component.label('YA_ASIGNADO')).toBe('Ya asignado'); });
  it('sin bloqueos sigue pendiente del Colegio', () => { expect(component.label('PENDIENTE_COLEGIO')).toBe('Pendiente del Colegio'); });
});
