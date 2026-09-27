import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AppUpdateService, AppVersionDevice, operationalScreen, validStoreLink } from './app-update.service';

describe('App update policy', () => {
  let service: AppUpdateService;
  let http: HttpTestingController;
  let router: { url: string; events: Subject<unknown> };
  let device: jasmine.SpyObj<AppVersionDevice>;
  const decision = (status: string, revision = 1) => ({ result: { status, revision,
    storeUrl: 'https://play.google.com/store/apps/details?id=mx.com.seclife.schoolmaster',
    recommendedVersion: '4.1.6', recommendedBuild: '20106' } });
  beforeEach(() => {
    device = jasmine.createSpyObj('AppVersionDevice', ['isNative', 'platform', 'hasGps', 'info', 'gpsStatus']);
    device.isNative.and.returnValue(true); device.platform.and.returnValue('android');
    device.hasGps.and.returnValue(false); device.info.and.resolveTo({ version: '4.1.5', build: '20105' });
    router = { url: '/home', events: new Subject() };
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Router, useValue: router }, { provide: AppVersionDevice, useValue: device }] });
    service = TestBed.inject(AppUpdateService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  async function check(status: string) {
    const pending = service.check(); await new Promise(resolve => setTimeout(resolve, 0));
    http.expectOne(r => r.url.includes('/app-version/check?') && r.url.includes('build=20105')).flush(decision(status));
    await pending;
  }
  it('blocks required updates using native build', async () => { await check('REQUIRED'); expect(service.blocked()).toBeTrue(); });
  it('does not block current releases', async () => { await check('CURRENT'); expect(service.blocked()).toBeFalse(); });
  it('allows postponing a recommended release', async () => {
    await check('RECOMMENDED'); expect(service.recommended()).toBeTrue(); service.postpone();
    await check('RECOMMENDED'); expect(service.recommended()).toBeFalse();
  });
  it('defers operational screens then blocks at home', async () => {
    router.url = '/transporte-escolar/conductor'; await check('REQUIRED'); expect(service.blocked()).toBeFalse();
    router.url = '/home'; await service.refreshSafety(); expect(service.blocked()).toBeTrue();
  });
  it('waits for requests in flight', async () => {
    service.beginRequest(); await check('REQUIRED'); expect(service.blocked()).toBeFalse();
    service.endRequest(); await service.refreshSafety(); expect(service.blocked()).toBeTrue();
  });
  it('does not interrupt native GPS away from its screen', async () => {
    device.hasGps.and.returnValue(true); device.gpsStatus.and.resolveTo({ running: true });
    await check('REQUIRED'); expect(service.blocked()).toBeFalse();
    device.gpsStatus.and.resolveTo({ running: false }); await service.refreshSafety(); expect(service.blocked()).toBeTrue();
  });
  it('does not turn an outage into an update lock', async () => {
    await check('REQUIRED');
    const pending = service.check(); await new Promise(resolve => setTimeout(resolve, 0));
    http.expectOne(r => r.url.includes('/app-version/check?')).flush({}, { status: 503, statusText: 'Unavailable' });
    await pending; expect(service.blocked()).toBeFalse(); expect(service.error()).toContain('conectividad');
  });
  it('unblocks when policy is withdrawn', async () => { await check('REQUIRED'); await check('CURRENT'); expect(service.blocked()).toBeFalse(); });
  it('rejects non-store links', () => {
    expect(validStoreLink('ios', 'https://apps.apple.com/mx/app/seclife/id123456')).toBeTrue();
    expect(validStoreLink('ios', 'https://apps.apple.com.evil.test/id123456')).toBeFalse();
    expect(validStoreLink('android', 'javascript:alert(1)')).toBeFalse();
  });
  it('recognizes active access screens', () => {
    expect(operationalScreen('/control-accesos/lectura-autogestionada')).toBeTrue();
    expect(operationalScreen('/control-accesos/red-familiar')).toBeFalse();
  });
});
