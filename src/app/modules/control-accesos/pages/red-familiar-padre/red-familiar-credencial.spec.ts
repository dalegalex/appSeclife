import { of, Subject, throwError } from 'rxjs';
import { RedFamiliarPadrePage } from './red-familiar-padre.page';
import { FotoFamiliarModalComponent } from './foto-familiar-modal.component';
import { BrigadaSemanalModalComponent } from './brigada-semanal-modal.component';
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
      consultarBrigadasSemanales: jasmine.createSpy().and.returnValue(of({visible:false,brigadas:[]})),
      consultarMiRed: jasmine.createSpy().and.callFake(() => of(page.rows)) };
    sheet = { create: jasmine.createSpy().and.resolveTo({ present: async () => {} }) };
    modal = { create: jasmine.createSpy().and.resolveTo({ present: async () => {} }) };
    page = new RedFamiliarPadrePage(api, {} as any, sheet, {} as any,
      { getCurrentUser: () => ({ idusrbt: 11, idorg: 1099 }) } as any, modal);
    page.rows = [{ idfamilia: 1, miembros: [{ idfamiliamiembro: 1, idusrbt: 11, familiar: 'Master', esMaster: true, sitactivo: true, idtag: 11, idsittag: 3, sitbloqueo: false }, miembro] }];
    toast = spyOn<any>(page, 'showToast').and.resolveTo();
  });
  it('hides brigades when disabled, unavailable, ordinary or silent', () => {
    page.cargarDisponibilidadBrigadas(); expect(page.brigadasVisibles()).toBeFalse();
    api.consultarBrigadasSemanales.and.returnValue(of({visible:true,brigadas:[]}));
    page.cargarDisponibilidadBrigadas(); expect(page.brigadasVisibles()).toBeTrue();
    api.consultarBrigadasSemanales.and.returnValue(throwError(()=>new Error('offline')));
    page.cargarDisponibilidadBrigadas(); expect(page.brigadasVisibles()).toBeFalse();
    api.consultarBrigadasSemanales.calls.reset(); page.rows[0].miembros![0].sitMiembroSilencioso=true;
    page.cargarDisponibilidadBrigadas(); expect(api.consultarBrigadasSemanales).not.toHaveBeenCalled();
    page.rows[0].miembros![0].sitMiembroSilencioso=false;page.rows[0].miembros![0].esMaster=false;
    page.cargarDisponibilidadBrigadas(); expect(api.consultarBrigadasSemanales).not.toHaveBeenCalled();
  });
  it('blocks administrative attempts for assigned, missing, unknown or blocked actor TAGs', async () => {
    const actor = page.rows[0].miembros![0];
    for (const state of [1, 4, undefined]) {
      actor.idsittag = state;
      expect(page.administracionBloqueadaPorTag).toBeTrue();
      page.toggleMiembroForm();
      expect(page.showMiembroForm).toBeFalse();
      await page.opcionesCredencial(miembro);
      expect(sheet.create).not.toHaveBeenCalled();
    }
    actor.idsittag = 3; actor.sitbloqueo = true;
    expect(page.administracionBloqueadaPorTag).toBeTrue();
    actor.sitbloqueo = false; actor.idtag = undefined;
    expect(page.administracionBloqueadaPorTag).toBeTrue();
    expect(toast).toHaveBeenCalledWith('Sus permisos de administrador se encuentran bloqueados, favor de comunicarse con su Colegio.', 'warning');
  });
  it('allows normal master/delegate administration with TAG 2 or 3 independently of digital credentials', () => {
    const actor = page.rows[0].miembros![0];
    page.credenciales.set([]);
    for (const state of [2, 3]) {
      actor.idsittag = state;
      expect(page.administracionBloqueadaPorTag).toBeFalse();
      actor.esMaster = false; actor.puedeAdministrar = true;
      expect(page.puedeAdministrarRed).toBeTrue();
      expect(page.administracionBloqueadaPorTag).toBeFalse();
    }
  });
  it('keeps own-photo activation and consultation without allowing edits to other members', async () => {
    const actor = page.rows[0].miembros![0]; actor.idsittag = 1;
    expect(page.puedeAdministrarRed).toBeTrue();
    expect(page.puedeEditarFotoMiembro(actor)).toBeTrue();
    expect(page.puedeEditarFotoMiembro(miembro)).toBeFalse();
    expect(page.puedeVerFotoMiembro({...miembro,tieneFoto:true})).toBeTrue();
    spyOn<any>(page, 'fileToBase64').and.resolveTo('base64');
    await page.cargarFotoMiembro(actor, {target:{files:[new File(['x'],'foto.jpg',{type:'image/jpeg'})],value:''}} as any);
    expect(api.actualizarMiembro).not.toHaveBeenCalled();
    expect(api.guardarFotoCredencial).toHaveBeenCalled();
    expect(page.administracionBloqueadaPorTag).toBeFalse();
  });
  it('keeps own photo capture available without a TAG and never grants an ordinary member administration', () => {
    const actor = page.rows[0].miembros![0];
    actor.idtag = undefined; actor.idsittag = undefined;
    expect(page.puedeEditarFotoMiembro(actor)).toBeTrue();
    actor.esMaster = false; actor.puedeAdministrar = false;
    actor.idtag = 11; actor.idsittag = 3;
    page.toggleMiembroForm();
    expect(page.showMiembroForm).toBeFalse();
    expect(page.puedeEditarFotoMiembro(actor)).toBeFalse();
    actor.puedeAdministrar = true; actor.sitMiembroSilencioso = true;
    expect(page.puedeAdministrarRed).toBeFalse();
  });
  it('cancels stale availability queries when the family reloads', () => {
    const previous=new Subject<any>(); api.consultarBrigadasSemanales.and.returnValue(previous);
    page.cargarDisponibilidadBrigadas();
    api.consultarBrigadasSemanales.and.returnValue(of({visible:false,brigadas:[]}));
    page.cargarDisponibilidadBrigadas(); previous.next({visible:true,brigadas:[]});
    expect(page.brigadasVisibles()).toBeFalse(); page.ngOnDestroy();
  });
  it('does not open the brigade of an external pupil', async () => {
    page.brigadasVisibles.set(true);
    await page.verBrigada({tipoRelacion:'FAMILIAR_COMPARTIDO_PERMANENTE'} as any);
    expect(modal.create).not.toHaveBeenCalled();
  });
  it('shows brigades only on registered nucleus pupils, failing closed for old responses', () => {
    const registered = {idmatricula:10,tipoRelacion:'FAMILIA_NUCLEO'} as any;
    const unregistered = {idmatricula:20,tipoRelacion:'FAMILIA_NUCLEO'} as any;
    api.consultarBrigadasSemanales.and.returnValue(of({visible:true,alumnos:[{idmatricula:10}],brigadas:[]}));
    page.cargarDisponibilidadBrigadas();
    expect(page.puedeConsultarBrigada(registered)).toBeTrue();
    expect(page.puedeConsultarBrigada(unregistered)).toBeFalse();
    expect(page.puedeConsultarBrigada({...registered,tipoRelacion:'FAMILIAR_COMPARTIDO_PERMANENTE'})).toBeFalse();
    api.consultarBrigadasSemanales.and.returnValue(of({visible:true,brigadas:[]}));page.cargarDisponibilidadBrigadas();
    expect(page.puedeConsultarBrigada(registered)).toBeFalse();
    expect(page.alumnosConBrigada().size).toBe(0);
  });
  it('lets the master or administrator upload a temporal photo without creating a user or TAG', async () => {
    const temporal: MiembroFamiliar = { idfamiliamiembro: 10, idfamilia: 1, idinvitadoexterno: 10, familiar: 'TEMPORAL', esExterno: true, sitactivo: true };
    api.guardarFotoTemporal = jasmine.createSpy().and.returnValue(of({ tieneFoto: true }));
    spyOn<any>(page, 'fileToBase64').and.resolveTo('base64');
    expect(page.puedeEditarFotoMiembro(temporal)).toBeTrue();
    await page.seleccionarOrigenFoto(temporal, {} as any, {} as any);
    expect(sheet.create).toHaveBeenCalled();
    await page.cargarFotoMiembro(temporal, { target: { files: [new File(['x'], 'foto.png', { type: 'image/png' })], value: '' } } as any);
    expect(api.guardarFotoTemporal).toHaveBeenCalledWith(1099, 1, 10, 'base64');
    expect(api.actualizarMiembro).not.toHaveBeenCalled();
    expect(api.guardarFotoCredencial).not.toHaveBeenCalled();
    expect(page.fotosEnProceso().size).toBe(0);
    page.rows[0].miembros![0].esMaster = false;
    expect(page.puedeEditarFotoMiembro(temporal)).toBeFalse();
    page.rows[0].miembros![0].puedeAdministrar = true;
    expect(page.puedeEditarFotoMiembro(temporal)).toBeTrue();
    expect(page.puedeVerFotoMiembro({ ...temporal, tieneFoto: true })).toBeTrue();
  });
  it('offers on-demand viewing only for a member with a photo', async () => {
    await page.seleccionarOrigenFoto({ ...miembro, tieneFoto: true }, {} as any, {} as any);
    expect(sheet.create.calls.mostRecent().args[0].buttons.map((b: any) => b.text)).toContain('Mostrar fotografia');
    expect(modal.create).not.toHaveBeenCalled();
    await page.seleccionarOrigenFoto({ ...miembro, tieneFoto: false }, {} as any, {} as any);
    expect(sheet.create.calls.mostRecent().args[0].buttons.map((b: any) => b.text)).not.toContain('Mostrar fotografia');
  });
  it('denies student changes until the organization explicitly enables them', async () => {
    const alumno: any = { idalumnoautorizacion: 7, tipoRelacion: 'FAMILIA_NUCLEO' };
    api.crearAlumnoAutorizacion = jasmine.createSpy();
    api.cambiarEstadoAlumno = jasmine.createSpy();
    page.toggleAlumnoForm();
    page.guardarAlumno();
    await page.eliminarAlumno(alumno);
    expect(page.showAlumnoForm).toBeFalse();
    expect(page.puedeAgregarAlumno).toBeFalse();
    expect(page.puedeQuitarAlumno(alumno)).toBeFalse();
    expect(api.crearAlumnoAutorizacion).not.toHaveBeenCalled();
    expect(api.cambiarEstadoAlumno).not.toHaveBeenCalled();
  });
  it('honors all four independent student policy combinations without changing sharing', () => {
    const alumno: any = { tipoRelacion: 'FAMILIA_NUCLEO' };
    const externo: any = { tipoRelacion: 'FAMILIAR_COMPARTIDO_PERMANENTE' };
    for (const agregar of [false, true]) for (const quitar of [false, true]) {
      Object.assign(page.rows[0], { permitirAgregarAlumnosNucleoApp: agregar, permitirQuitarAlumnosNucleoApp: quitar });
      expect(page.puedeAgregarAlumno).toBe(agregar);
      expect(page.puedeQuitarAlumno(alumno)).toBe(quitar);
      expect(page.puedeQuitarAlumno(externo)).toBeFalse();
      expect(page.puedeCompartirAlumno(alumno)).toBeTrue();
      expect(page.esAlumnoCompartidoExterno(externo)).toBeTrue();
    }
  });
  it('requires family administration even when the organization enables student changes', () => {
    Object.assign(page.rows[0], { permitirAgregarAlumnosNucleoApp: true, permitirQuitarAlumnosNucleoApp: true });
    const actor = page.rows[0].miembros![0];
    const alumno: any = { tipoRelacion: 'FAMILIA_NUCLEO' };
    actor.esMaster = false;
    expect(page.puedeAgregarAlumno).toBeFalse();
    expect(page.puedeQuitarAlumno(alumno)).toBeFalse();
    actor.puedeAdministrar = true;
    expect(page.puedeAgregarAlumno).toBeTrue();
    expect(page.puedeQuitarAlumno(alumno)).toBeTrue();
    page.loading = true;
    expect(page.puedeAgregarAlumno).toBeFalse();
    expect(page.puedeQuitarAlumno(alumno)).toBeFalse();
  });
  it('rechecks student removal policy after confirmation', async () => {
    Object.assign(page.rows[0], { permitirQuitarAlumnosNucleoApp: true });
    api.cambiarEstadoAlumno = jasmine.createSpy();
    spyOn<any>(page, 'confirmar').and.callFake(async () => {
      page.rows[0].permitirQuitarAlumnosNucleoApp = false;
      return true;
    });
    await page.eliminarAlumno({ idalumnoautorizacion: 7, tipoRelacion: 'FAMILIA_NUCLEO' } as any);
    expect(api.cambiarEstadoAlumno).not.toHaveBeenCalled();
  });
  it('reloads the complete network after nucleus removal instead of exposing a remaining temporary row', async () => {
    const base = { ...page.rows[0], permitirQuitarAlumnosNucleoApp: true };
    const nucleus: any = { ...base, idalumnoautorizacion: 7, idmatricula: 22, alumno: 'Alumno prueba', tipoRelacion: 'FAMILIA_NUCLEO' };
    const other: any = { ...base, idalumnoautorizacion: 10, idmatricula: 23, alumno: 'Otro alumno', tipoRelacion: 'FAMILIA_NUCLEO' };
    page.rows = [nucleus, { ...nucleus, idalumnoautorizacion: 8, tipoRelacion: 'INVITADO_EXTERNO' }, other];
    spyOn<any>(page, 'confirmar').and.resolveTo(true);
    spyOn<any>(page, 'cargarCodigosEmitidos').and.stub();
    api.cambiarEstadoAlumno = jasmine.createSpy().and.returnValue(of({}));
    api.consultarMiRed.and.returnValue(of([other]));
    await page.eliminarAlumno(nucleus);
    expect(api.cambiarEstadoAlumno).toHaveBeenCalledWith(7, 1099, false);
    expect(api.consultarMiRed).toHaveBeenCalledWith(1099);
    expect(page.alumnos.map(a => a.idmatricula)).toEqual([23]);
    expect(page.rows.some(r => r.tipoRelacion === 'INVITADO_EXTERNO')).toBeFalse();
  });
  it('does not remove a student locally when the server rejects removal', async () => {
    const nucleus: any = { ...page.rows[0], permitirQuitarAlumnosNucleoApp: true,
      idalumnoautorizacion: 7, idmatricula: 22, alumno: 'Alumno prueba', tipoRelacion: 'FAMILIA_NUCLEO' };
    page.rows = [nucleus];
    spyOn<any>(page, 'confirmar').and.resolveTo(true);
    api.cambiarEstadoAlumno = jasmine.createSpy().and.returnValue(throwError(() => new Error('No permitido')));
    await page.eliminarAlumno(nucleus);
    expect(page.alumnos.length).toBe(1);
    expect(api.consultarMiRed).not.toHaveBeenCalled();
  });
  it('closes student editing and clears policy permissions on a failed refresh', () => {
    Object.assign(page.rows[0], { permitirAgregarAlumnosNucleoApp: true, permitirQuitarAlumnosNucleoApp: true });
    page.showAlumnoForm = true;
    api.consultarMiRed.and.returnValue(throwError(() => new Error('offline')));
    (page as any).recargarRed();
    expect(page.showAlumnoForm).toBeFalse();
    expect(page.puedeAgregarAlumno).toBeFalse();
    expect(page.puedeQuitarAlumno({ tipoRelacion: 'FAMILIA_NUCLEO' } as any)).toBeFalse();
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
    expect(api.actualizarMiembro).not.toHaveBeenCalled();
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
