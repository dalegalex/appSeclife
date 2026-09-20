import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TutorialesService } from './tutoriales.service';

describe('TutorialesService', () => {
  let service: TutorialesService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting()]});
    service=TestBed.inject(TutorialesService);http=TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('envia filtros y offset sin identidad ni organizacion del cliente', () => {
    service.list(20,'  familia  ','RED_FAMILIAR').subscribe(rows=>expect(rows).toEqual([]));
    const req=http.expectOne(r=>r.url.endsWith('/tutoriales'));
    expect(req.request.params.keys().sort()).toEqual(['buscar','categoria','topi']);
    expect(req.request.params.get('buscar')).toBe('familia');
    expect(req.request.params.get('topi')).toBe('20');
    req.flush({result:[],codeNumber:200,message:'OK'});
  });
  it('reproduccion usa consulta final y no vista previa administrativa', () => {
    service.playback(7).subscribe();
    const req=http.expectOne(r=>r.url.endsWith('/tutoriales/7/reproduccion'));
    expect(req.request.method).toBe('POST');expect(req.request.body).toEqual({});
    req.flush({result:{url:'https://test',expiresAt:'2026-09-20'},codeNumber:200,message:'OK'});
  });
});
