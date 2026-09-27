import { EMPTY, of, throwError } from 'rxjs';
import { LecturaAsistidaPage } from './lectura-asistida.page';
import { LecturaAsistidaService } from '../../services/lectura-asistida.service';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

describe('Identificar persona temporal', () => {
  let page: LecturaAsistidaPage;
  let api: any;
  let toast: jasmine.Spy;
  const temporal: any = { esTemporal: true, idperfil: 6, tipoPortador: 'FAMILIAR', idfamiliamiembro: 10, nombreCompleto: 'TEMPORAL', credencialDisponible: true, foto: 'foto' };
  beforeEach(() => {
    api = { resolverIdentidadManual: jasmine.createSpy().and.returnValue(of({
      tipoLectura: 'INVITADO_EXTERNO', sentido: 'SALIDA', credencial: { codigo: '123456' }, familiar: {}, alumnos: []
    })) };
    page = new LecturaAsistidaPage(api, { cierre$: EMPTY } as any, {} as any, {} as any,
      { getCurrentUser: () => ({ idorg: 1011 }) } as any, {} as any, { detectChanges: () => {} } as any);
    toast = spyOn<any>(page, 'showToast').and.resolveTo();
    spyOn<any>(page, 'aplicarLectura').and.callFake((r: any) => { page.lectura = r; });
  });
  it('revalidates by member ID and uses the actual QR flow for delivery', async () => {
    page.modoAviso = true;
    await page.seleccionarIdentidad(temporal);
    expect(api.resolverIdentidadManual.calls.mostRecent().args[0].idfamiliamiembroTemporal).toBe(10);
    expect(page.identificacionManual).toBeFalse();
    expect(page.identidadManualSeleccionada).toBeNull();
    expect(page.codigo).toBe('123456');
    expect(page.sentido).toBe('SALIDA');
    expect(page.modoAviso).toBeFalse();
    expect(page.lectura?.familiar?.foto).toBe('foto');
  });
  it('reports disabled passes without registering a reading', async () => {
    await page.seleccionarIdentidad({ ...temporal, credencialDisponible: false, motivoNoDisponible: 'PASE QR INHABILITADO' });
    expect(toast).toHaveBeenCalledWith('PASE QR INHABILITADO', 'warning');
    expect(api.resolverIdentidadManual).not.toHaveBeenCalled();
  });
  it('does not keep a reading if the pass expired after searching', async () => {
    api.resolverIdentidadManual.and.returnValue(throwError(() => ({ status: 422, error: { message: 'PASE QR INHABILITADO' } })));
    await page.seleccionarIdentidad(temporal);
    expect(page.lectura).toBeNull();
    expect(page.loading).toBeFalse();
    expect(page.codigo).toBe('');
  });
});

describe('Busqueda combinada de familiares', () => {
  it('merges family and temporal results without querying temporals for students', () => {
    TestBed.configureTestingModule({ providers: [LecturaAsistidaService, provideHttpClient(), provideHttpClientTesting()] });
    const svc = TestBed.inject(LecturaAsistidaService);
    const http = TestBed.inject(HttpTestingController);
    let rows: any[] = [];
    svc.buscarIdentidades(1011, 'FAMILIAR', 'PRUEBA').subscribe(r => rows = r.resultados ?? []);
    http.expectOne(r => r.url.endsWith('/identidades')).flush({ codeNumber: 200, result: { resultados: [{ nombreCompleto: 'Z FAMILIAR' }] } });
    http.expectOne(r => r.url.endsWith('/temporales')).flush({ codeNumber: 200, result: { resultados: [{ nombreCompleto: 'A TEMPORAL', esTemporal: true }] } });
    expect(rows.length).toBe(2); expect(rows[0].esTemporal).toBeTrue();
    svc.buscarIdentidades(1011, 'ALUMNO', 'PRUEBA').subscribe();
    http.expectOne(r => r.url.endsWith('/identidades')).flush({ codeNumber: 200, result: { resultados: [] } });
    http.expectNone(r => r.url.endsWith('/temporales'));
    http.verify();
  });
});
