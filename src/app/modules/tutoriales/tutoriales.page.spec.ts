import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { SessionLockStateService } from '../../core/auth/session-lock-state.service';
import { TutorialesPage } from './tutoriales.page';
import { PlaybackLink, Tutorial, TutorialesService } from './tutoriales.service';

describe('TutorialesPage', () => {
  let page: TutorialesPage;
  let service: jasmine.SpyObj<TutorialesService>;
  let auth: {loadAppMenu: jasmine.Spy; canAccessAppRoute: jasmine.Spy};
  const row: Tutorial = {id:1,titulo:'Red familiar',descripcion:'Demo',categoria:'RED_FAMILIAR',versionApp:'',duracion:60,bytes:100,ancho:900,alto:1920};
  const link: PlaybackLink = {url:'https://test.blob.core.windows.net/seclife-tutoriales/videos/1/demo.mp4?sig=demo',expiresAt:new Date(Date.now()+900000).toISOString()};
  beforeEach(() => {
    service=jasmine.createSpyObj('TutorialesService',['list','playback']);
    service.list.and.returnValue(of([row])); service.playback.and.returnValue(of(link));
    auth={loadAppMenu:jasmine.createSpy().and.returnValue(of([])),canAccessAppRoute:jasmine.createSpy().and.returnValue(true)};
    TestBed.configureTestingModule({imports:[TutorialesPage],providers:[{provide:TutorialesService,useValue:service},{provide:AuthService,useValue:auth},{provide:SessionLockStateService,useValue:{locked:signal(false)}}]});
    page=TestBed.runInInjectionContext(() => new TutorialesPage());
  });
  afterEach(() => page.ngOnDestroy());
  it('muestra titulo y duracion sin precargar reproductores',async () => {
    const fixture=TestBed.createComponent(TutorialesPage);
    await fixture.componentInstance.ionViewWillEnter();fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Red familiar');
    expect(fixture.nativeElement.textContent).toContain('1:00');
    expect(fixture.nativeElement.querySelector('video')).toBeNull();fixture.destroy();
  });
  it('no consulta si el menu deniega acceso',async () => {
    auth.canAccessAppRoute.and.returnValue(false);await page.ionViewWillEnter();expect(service.list).not.toHaveBeenCalled();expect(page.allowed()).toBeFalse();
  });
  it('lista sin solicitar SAS para todos los videos',async () => {
    await page.ionViewWillEnter();expect(page.rows().length).toBe(1);expect(service.playback).not.toHaveBeenCalled();
  });
  it('carga bloques de 20 y conserva filtros',async () => {
    service.list.and.returnValue(of(Array.from({length:20},(_,i)=>({...row,id:i+1}))));
    await page.ionViewWillEnter();service.list.and.returnValue(of([{...row,id:21}]));await page.load();
    expect(service.list).toHaveBeenCalledWith(20,'','');expect(page.rows().length).toBe(21);expect(page.more()).toBeFalse();
  });
  it('ignora respuestas anteriores al cambio de filtro',async () => {
    await page.ionViewWillEnter();const pending=new Subject<Tutorial[]>();service.list.and.returnValue(pending);const old=page.reload();
    page.filters.controls.buscar.setValue(' nuevo ');service.list.and.returnValue(of([{...row,id:2}]));await page.reload();
    pending.next([row]);pending.complete();await old;expect(page.rows().map(r=>r.id)).toEqual([2]);expect(service.list).toHaveBeenCalledWith(0,'nuevo','');
  });
  it('solicita enlace solo al abrir y lo elimina al salir',async () => {
    await page.ionViewWillEnter();await page.open(row);expect(service.playback).toHaveBeenCalledOnceWith(1);expect(page.link()).toEqual(link);
    page.close();expect(page.link()).toBeNull();expect(page.rows().length).toBe(1);
  });
  it('ignora enlace que llega despues de cerrar',async () => {
    await page.ionViewWillEnter();const pending=new Subject<PlaybackLink>();service.playback.and.returnValue(pending);
    const open=page.open(row);page.close();pending.next(link);pending.complete();await open;expect(page.link()).toBeNull();
  });
  it('no reproduce contenido retirado y permite reintentar',async () => {
    await page.ionViewWillEnter();service.playback.and.returnValue(throwError(()=>({status:404})));
    await page.open(row);expect(page.link()).toBeNull();expect(page.playerError()).toContain('no esta disponible');
  });
  it('renueva una vez automaticamente un SAS vencido',async () => {
    await page.ionViewWillEnter();service.playback.and.returnValue(of({...link,expiresAt:'2020-01-01T00:00:00Z'}));
    await page.open(row);await page.playbackError();await page.playbackError();expect(service.playback.calls.count()).toBe(2);
  });
  it('descarta resultados cuando se abandona la pantalla',async () => {
    await page.ionViewWillEnter();const pending=new Subject<Tutorial[]>();service.list.and.returnValue(pending);
    const request=page.reload();page.ionViewWillLeave();pending.next([row]);pending.complete();await request;expect(page.rows()).toEqual([]);
  });
});
