import { of, Subject, throwError } from 'rxjs';
import { RedFamiliarPadrePage } from './red-familiar-padre.page';
import { FotoFamiliarModalComponent } from './foto-familiar-modal.component';
import { CredencialFamiliar, MiembroFamiliar } from '../../models/red-familiar.model';

describe('Red Familiar credential actions', () => {
  let page: RedFamiliarPadrePage;
  let api: any;
  let toast: jasmine.Spy;
  let sheet: any;
  let modal: any;
  const miembro: MiembroFamiliar = { idfamiliamiembro: 2, idfamilia: 1, idusrbt: 22, familiar: 'Familiar Prueba', idsittag: 1, codigo: 'VRPRUEBA', sitactivo: true };
  const credencial: CredencialFamiliar = { idfamiliamiembro: 2, idusrbt: 22, idtag: 3, nombreCompleto: 'Familiar Prueba', organizacion: 'Colegio Prueba', nombreFamilia: 'Familia Prueba', idciclo: 202627, cicloEscolar: '2026-2027', activa: true, virtual: true, puedeRegenerar: true, codigo: 'VRPRUEBA' };
  beforeEach(() => {
    api = { consultarCredenciales: jasmine.createSpy().and.returnValue(of([credencial])),
      actualizarMiembro: jasmine.createSpy().and.returnValue(of(miembro)),
      guardarFotoCredencial: jasmine.createSpy().and.returnValue(of({ idsittag: 3, tagActivada: true })),
      consultarMiRed: jasmine.createSpy().and.callFake(() => of(page.rows)) };
    sheet = { create: jasmine.createSpy().and.resolveTo({ present: async () => {} }) };
    modal = { create: jasmine.createSpy().and.resolveTo({ present: async () => {} }) };
    page = new RedFamiliarPadrePage(api, {} as any, sheet, {} as any,
      { getCurrentUser: () => ({ idusrbt: 11, idorg: 1099 }) } as any, modal);
    page.rows = [{ idfamilia: 1, miembros: [{ idfamiliamiembro: 1, idusrbt: 11, familiar: 'Master', esMaster: true, sitactivo: true }, miembro] }];
    toast = spyOn<any>(page, 'showToast').and.resolveTo();
  });
  it('offers on-demand viewing only for a member with a photo', async () => {
    await page.seleccionarOrigenFoto({ ...miembro, tieneFoto: true }, {} as any, {} as any);
    expect(sheet.create.calls.mostRecent().args[0].buttons.map((b: any) => b.text)).toContain('Mostrar fotografia');
    expect(modal.create).not.toHaveBeenCalled();
    await page.seleccionarOrigenFoto({ ...miembro, tieneFoto: false }, {} as any, {} as any);
    expect(sheet.create.calls.mostRecent().args[0].buttons.map((b: any) => b.text)).not.toContain('Mostrar fotografia');
  });
  it('honors photo metadata and supports older server responses', () => {
    expect(page.miembroTieneFoto({ ...miembro, tieneFoto: false, foto: 'old' })).toBeFalse();
    expect(page.miembroTieneFoto({ ...miembro, tieneFoto: true })).toBeTrue();
    expect(page.miembroTieneFoto({ ...miembro, foto: 'old' })).toBeTrue();
  });
  it('hides inactive membership even when a different active user has the same name', () => {
    page.rows = [{ idfamilia: 1, miembros: [
      { ...miembro, idfamiliamiembro: 8, idusrbt: 16929, sitactivo: false },
      { ...miembro, idfamiliamiembro: 10, idusrbt: 16935, sitactivo: true },
    ] }];
    expect(page.familiares.map(m => m.idusrbt)).toEqual([16935]);
  });
  it('keeps all family members when the server sends them in only one student row', () => {
    const members = page.rows[0].miembros;
    page.rows = [{ idfamilia: 1, idmatricula: 101, miembros: [] },
      { idfamilia: 1, idmatricula: 102, miembros: members },
      { idfamilia: 1, idmatricula: 103, miembros: [] }];
    expect(page.familiares.length).toBe(2);
    expect(page.puedeAdministrarRed).toBeTrue();
  });
  it('supports the compact production payload with a photo only in its sole member list', () => {
    page.rows = [{ idfamilia: 1, miembros: [{ ...miembro, foto: 'base64-production' }] },
      { idfamilia: 1, miembros: [] }];
    expect(page.familiares.length).toBe(1);
    expect(page.miembroTieneFoto(page.familiares[0])).toBeTrue();
  });
  it('preserves access restrictions for external and ordinary members', async () => {
    for (const blocked of [{ ...miembro, esExterno: true }]) {
      await page.mostrarFotoMiembro({ ...blocked, tieneFoto: true });
    }
    page.rows[0].miembros![0].esMaster = false;
    await page.mostrarFotoMiembro({ ...miembro, tieneFoto: true });
    expect(modal.create).not.toHaveBeenCalled();
  });
  it('allows viewing without editing for processing and activated TAGs', async () => {
    for (const idsittag of [2, 3]) {
      const member = { ...miembro, idsittag, tieneFoto: true };
      expect(page.puedeEditarFotoMiembro(member)).toBeFalse();
      expect(page.puedeAbrirMenuFoto(member)).toBeTrue();
      await page.seleccionarOrigenFoto(member, {} as any, {} as any);
      expect(sheet.create.calls.mostRecent().args[0].buttons.map((b: any) => b.text)).toEqual(['Mostrar fotografia', 'Cancelar']);
      await page.mostrarFotoMiembro(member);
    }
    expect(modal.create).toHaveBeenCalledTimes(2);
  });
  it('does not enable a photo menu for a locked member without a photo', () => {
    expect(page.puedeAbrirMenuFoto({ ...miembro, idsittag: 3, tieneFoto: false })).toBeFalse();
  });
  it('opens the viewer with family scope only after an explicit request', async () => {
    await page.mostrarFotoMiembro({ ...miembro, tieneFoto: true });
    expect(modal.create.calls.mostRecent().args[0].componentProps).toEqual({ idorg: 1099, idfamilia: 1, idmiembro: 2, nombre: 'Familiar Prueba' });
  });
  it('cancels a pending photo request when the viewer closes', () => {
    const response = new Subject<string>();
    const service = { consultarFotoFamiliar: jasmine.createSpy().and.returnValue(response) };
    const viewer = new FotoFamiliarModalComponent(service as any, {} as any);
    viewer.idorg = 1099; viewer.idfamilia = 1; viewer.idmiembro = 2;
    viewer.ngOnInit();
    expect(viewer.cargando()).toBeTrue();
    viewer.ngOnDestroy();
    expect(response.observed).toBeFalse();
    expect(viewer.foto()).toBeNull();
  });
  it('renders photo success and reports an unavailable photo without retaining it', () => {
    const viewer = new FotoFamiliarModalComponent({ consultarFotoFamiliar: () => of('data:image/jpeg;base64,eA==') } as any, {} as any);
    viewer.ngOnInit();
    expect(viewer.cargando()).toBeFalse();
    expect(viewer.foto()).toContain('data:image/');
    viewer.imagenFallida();
    expect(viewer.foto()).toBeNull();
    expect(viewer.error()).toBeTruthy();
  });
  it('allows master and delegated administrator, but not ordinary members', () => {
    expect(page.puedeAdministrarRed).toBeTrue();
    page.rows[0].miembros![0].esMaster = false;
    expect(page.puedeAdministrarRed).toBeFalse();
    page.rows[0].miembros![0].puedeAdministrar = true;
    expect(page.puedeAdministrarRed).toBeTrue();
    page.rows[0].miembros![0].sitMiembroSilencioso = true;
    expect(page.puedeAdministrarRed).toBeFalse();
  });
  it('does not expose credential actions for external members', () => {
    page.credenciales.set([credencial]);
    expect(page.credencialMiembro({ ...miembro, esExterno: true })).toBeUndefined();
  });
  it('does not share an inactive credential', async () => {
    page.credenciales.set([{ ...credencial, activa: false }]);
    await page.compartirCredencial(miembro);
    expect(page.credencialEnProceso()).toBeNull();
  });
  it('shows the server family quota error and keeps the unsaved member form', () => {
    const message = 'Se alcanzo el limite de 3 familiares adicionales al master permitido por tu Colegio.';
    api.crearMiembro = jasmine.createSpy().and.returnValue(throwError(() => ({ status: 422, error: { codeNumber: 63306, message } })));
    page.miembroForm = { ...page.miembroForm, nombre: 'Familiar', apellidos: 'Nuevo' };
    page.showMiembroForm = true;
    const before = page.familiares.length;
    page.guardarMiembro();
    expect(toast).toHaveBeenCalledWith(message, 'danger');
    expect(page.savingMiembro).toBeFalse();
    expect(page.showMiembroForm).toBeTrue();
    expect(page.miembroForm.nombre).toBe('Familiar');
    expect(page.familiares.length).toBe(before);
  });
  it('does not regenerate a physical credential', async () => {
    page.credenciales.set([{ ...credencial, virtual: false, puedeRegenerar: false }]);
    await page.regenerarCredencial(miembro);
    expect(page.credencialEnProceso()).toBeNull();
  });
  it('keeps the photo busy until save and refresh complete and prevents duplicate uploads', async () => {
    const saved = new Subject<any>();
    api.guardarFotoCredencial.and.returnValue(saved);
    spyOn<any>(page, 'fileToBase64').and.resolveTo('aGVsbG8=');
    spyOn<any>(page, 'loadImage').and.resolveTo({});
    const event = () => ({ target: { files: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })], value: 'foto.jpg' } } as unknown as Event);
    const pending = page.cargarFotoMiembro(miembro, event());
    expect(page.fotosEnProceso().has(2)).toBeTrue();
    await page.cargarFotoMiembro(miembro, event());
    await Promise.resolve(); await Promise.resolve();
    saved.next({ idsittag: 3 }); saved.complete();
    await pending;
    expect(api.actualizarMiembro).toHaveBeenCalledTimes(1);
    expect(page.fotosEnProceso().size).toBe(0);
    expect(page.familiares.find(m => m.idfamiliamiembro === 2)?.idsittag).toBe(3);
  });
  it('clears busy state after a failed photo read', async () => {
    spyOn<any>(page, 'fileToBase64').and.rejectWith(new Error('lectura fallida'));
    await page.cargarFotoMiembro(miembro, { target: { files: [new File(['x'], 'f.jpg', { type: 'image/jpeg' })], value: '' } } as unknown as Event);
    expect(page.fotosEnProceso().size).toBe(0);
    expect(toast).toHaveBeenCalled();
  });
  it('generates a nonblank PNG with a full long name', async () => {
    const image = await page.crearImagenCredencial({ ...credencial, nombreCompleto: 'APELLIDO'.repeat(30) + ' Nombre Segundo Apellido' });
    expect(image.startsWith('data:image/png;base64,')).toBeTrue();
    expect(image.length).toBeGreaterThan(10000);
  });
  it('draws organization, family and school year inside the image', async () => {
    const draw = spyOn(CanvasRenderingContext2D.prototype, 'fillText').and.callThrough();
    await page.crearImagenCredencial(credencial);
    const texts = draw.calls.allArgs().map(args => args[0]);
    expect(texts).toContain('CREDENCIAL DIGITAL');
    expect(texts).not.toContain('CREDENCIAL VIRTUAL');
    expect(texts).toContain('Colegio Prueba');
    expect(texts).toContain('Familia: Familia Prueba');
    expect(texts).toContain('Ciclo escolar: 2026-2027');
    expect(texts).toContain('Familiar Prueba');
    for (const call of draw.calls.all()) {
      const ctx = call.object as CanvasRenderingContext2D;
      expect(call.args[2]).toBeLessThan(ctx.canvas.height);
    }
  });
  it('does not share an incomplete image when SQL metadata is missing', async () => {
    await expectAsync(page.crearImagenCredencial({ ...credencial, organizacion: '' })).toBeRejectedWithError(/Faltan datos/);
  });
  it('labels sharing as digital and keeps virtual regeneration as a separate option', async () => {
    const create = jasmine.createSpy().and.resolveTo({ present: async () => {} });
    (page as any).actionSheetController = { create };
    page.credenciales.set([credencial]);
    await page.opcionesCredencial(miembro);
    const labels = create.calls.mostRecent().args[0].buttons.map((button: any) => button.text);
    expect(labels).toContain('Compartir credencial digital');
    expect(labels).toContain('Regenerar codigo virtual');
    expect(labels).not.toContain('Compartir credencial virtual');
  });
  for (const state of [
    { activa: true, virtual: true, share: true, regenerate: true },
    { activa: true, virtual: false, share: true, regenerate: false },
    { activa: false, virtual: true, share: false, regenerate: true },
    { activa: false, virtual: false, share: false, regenerate: false },
  ]) {
    it(`shows independent options for active=${state.activa}, virtual=${state.virtual}`, async () => {
      const create = jasmine.createSpy().and.resolveTo({ present: async () => {} });
      (page as any).actionSheetController = { create };
      page.credenciales.set([{ ...credencial, activa: state.activa, virtual: state.virtual, puedeRegenerar: state.virtual }]);
      await page.opcionesCredencial(miembro);
      const labels = create.calls.mostRecent().args[0].buttons.map((button: any) => button.text);
      expect(labels.includes('Compartir credencial digital')).toBe(state.share);
      expect(labels.includes('Regenerar codigo virtual')).toBe(state.regenerate);
    });
  }
});
