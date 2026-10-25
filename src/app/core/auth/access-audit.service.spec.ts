import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Capacitor } from '@capacitor/core';
import { AccessAuditService } from './access-audit.service';

describe('AccessAuditService', () => {
  let http: HttpTestingController;
  let service: AccessAuditService;
  let foreground: (event: { isActive: boolean }) => void;
  beforeEach(() => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    spyOn(Capacitor, 'getPlatform').and.returnValue('android');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AccessAuditService);
    // Exercise the callback body; native listener binding is covered by device acceptance tests.
    foreground = () => (service as unknown as { activity(): void }).activity();
  });
  afterEach(() => http.verify());
  const isAudit = (request: { url: string }) => request.url.endsWith('/app-access/events');

  it('sends no event before authentication and no metadata to third parties', () => {
    foreground({isActive:true});
    http.expectNone(isAudit);
    expect(service.requestHeaders('https://other.example/path')).toEqual({});
  });
  it('throttles activity and does not count local foreground as authentication', () => {
    service.session('test-token');
    const req=http.expectOne(isAudit);
    expect(req.request.body.event).toBe('ACTIVIDAD_RECIBIDA');
    expect(req.request.body.token).toBeUndefined();
    req.flush(null);
    foreground({isActive:true});foreground({isActive:true});
    http.expectNone(isAudit);
  });
  it('retries one event with the same id and discards it on change of identity', () => {
    service.session('first');
    const req=http.expectOne(isAudit);const id=req.request.body.eventId;
    req.flush({}, {status:503,statusText:'Unavailable'});
    foreground({isActive:true});
    const retry=http.expectOne(isAudit);expect(retry.request.body.eventId).toBe(id);
    retry.flush({}, {status:503,statusText:'Unavailable'});
    service.session('second');
    const next=http.expectOne(isAudit);
    expect(next.request.body.eventId).not.toBe(id);
    expect(next.request.headers.get('Authorization')).toBe('Bearer second');
    next.flush(null);
  });
  it('reports explicit logout without retaining the session for future telemetry', () => {
    service.session('test');http.expectOne(isAudit).flush(null);
    service.logout();
    const req=http.expectOne(isAudit);expect(req.request.body.event).toBe('CIERRE_SESION');
    req.flush({}, {status:503,statusText:'Unavailable'});
    foreground({isActive:true});http.expectNone(isAudit);
  });
});
