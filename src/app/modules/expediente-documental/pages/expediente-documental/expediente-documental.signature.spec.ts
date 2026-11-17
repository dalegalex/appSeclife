import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AlertController, ToastController } from '@ionic/angular';
import { of, Subject, throwError } from 'rxjs';
import { ExpedienteDocumentalPage } from './expediente-documental.page';
import { ExpedienteDocumentalService } from '../../services/expediente-documental.service';
import { DetalleAsignacion, DocumentoFirmante } from '../../models/expediente-documental.model';

describe('Expediente documental: lienzo y JPEG', () => {
  let page: ExpedienteDocumentalPage;
  let service: jasmine.SpyObj<any>;
  let toast: jasmine.SpyObj<any>;
  const otp = { idotpdesafio: 10, nonce: 'test', fechaExpiracion: '', destino: 'demo@example.com' };

  beforeEach(() => {
    service = jasmine.createSpyObj('service', ['registrarFirma']);
    service.registrarFirma.and.returnValue(of({ result: otp }));
    toast = jasmine.createSpyObj('toast', ['create']);
    toast.create.and.resolveTo({ present: async () => undefined });
    page = new ExpedienteDocumentalPage(service, toast, {} as AlertController);
    page.selectedDocument = { idasignacion: 34 } as DocumentoFirmante;
    page.detail = { requiereFirmaGrafica: true } as DetalleAsignacion;
    page.legalAccepted = true;
  });

  function canvas(): HTMLCanvasElement {
    const result = document.createElement('canvas');
    result.width = 900;
    result.height = 300;
    return result;
  }

  function draw(target: HTMLCanvasElement): void {
    const ctx = target.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(100, 200);
    ctx.bezierCurveTo(200, 20, 400, 280, 600, 80);
    ctx.stroke();
    page.hasSignature = true;
  }

  async function pixels(blob: Blob): Promise<Uint8ClampedArray> {
    const image = await createImageBitmap(blob);
    const output = canvas();
    output.getContext('2d')!.drawImage(image, 0, 0);
    image.close();
    return output.getContext('2d')!.getImageData(0, 0, 900, 300).data;
  }

  it('inicializa el lienzo cuando Angular lo crea despues de los datos', async () => {
    await TestBed.configureTestingModule({
      declarations: [ExpedienteDocumentalPage],
      providers: [
        { provide: ExpedienteDocumentalService, useValue: service },
        { provide: ToastController, useValue: toast },
        { provide: AlertController, useValue: {} },
      ],
    }).overrideComponent(ExpedienteDocumentalPage, {
      set: { template: '@if (!loadingDetail) { <canvas #signatureCanvas width="900" height="300"></canvas> }', styles: [], styleUrls: [] },
    }).compileComponents();
    const fixture = TestBed.createComponent(ExpedienteDocumentalPage);
    spyOn(fixture.componentInstance, 'load').and.resolveTo();
    fixture.componentInstance.loadingDetail = true;
    fixture.detectChanges();
    expect(fixture.componentInstance.signatureCanvas).toBeUndefined();
    fixture.componentInstance.loadingDetail = false;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const ctx = fixture.componentInstance.signatureCanvas!.nativeElement.getContext('2d')!;
    expect(Array.from(ctx.getImageData(0, 0, 1, 1).data)).toEqual([255, 255, 255, 255]);
    fixture.destroy();
  });

  it('reinicia el estado al destruir y recrear el lienzo', () => {
    page.signatureCanvas = new ElementRef(canvas());
    page.hasSignature = true;
    page.drawing = true;
    page.signatureCanvas = undefined;
    page.signatureCanvas = new ElementRef(canvas());
    expect(page.hasSignature).toBeFalse();
    expect(page.drawing).toBeFalse();
    expect(page.signatureCanvas!.nativeElement.getContext('2d')!.lineWidth).toBe(8);
  });

  it('no borra trazos al recibir el mismo elemento', () => {
    const ref = new ElementRef(canvas());
    page.signatureCanvas = ref;
    draw(ref.nativeElement);
    page.signatureCanvas = ref;
    expect(page.hasSignature).toBeTrue();
  });

  it('exporta blanco y trazos aun si la fuente es transparente', async () => {
    const source = canvas();
    page.signatureCanvas = new ElementRef(source);
    source.getContext('2d')!.clearRect(0, 0, 900, 300);
    draw(source);
    const blob: Blob = await (page as any).canvasBlob();
    expect(blob.type).toBe('image/jpeg');
    const data = await pixels(blob);
    expect(Array.from(data.slice(0, 4))).toEqual([255, 255, 255, 255]);
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] < 100) dark++;
    expect(dark).toBeGreaterThan(100);
    expect(dark).toBeLessThan(27000);
    expect(source.getContext('2d')!.getImageData(0, 0, 1, 1).data[3]).toBe(0);
  });

  it('limpia trazos y exige volver a dibujar', async () => {
    page.signatureCanvas = new ElementRef(canvas());
    draw(page.signatureCanvas.nativeElement);
    page.clearSignature();
    expect(page.hasSignature).toBeFalse();
    await page.submitSignature();
    expect(service.registrarFirma).not.toHaveBeenCalled();
  });

  it('permite limpiar y reintentar tras rechazo del API sin crear OTP local', async () => {
    page.signatureCanvas = new ElementRef(canvas());
    draw(page.signatureCanvas.nativeElement);
    service.registrarFirma.and.returnValue(throwError(() => ({ error: { message: 'Limpia y vuelve a firmar.' } })));
    await page.submitSignature();
    expect(page.otp).toBeNull();
    expect(page.savingSignature).toBeFalse();
    expect(toast.create).toHaveBeenCalledWith(jasmine.objectContaining({ message: 'Limpia y vuelve a firmar.' }));
    page.clearSignature();
    draw(page.signatureCanvas.nativeElement);
    service.registrarFirma.and.returnValue(of({ result: otp }));
    await page.submitSignature();
    expect(page.otp?.idotpdesafio).toBe(10);
  });

  it('bloquea doble envio y limpieza durante la peticion', async () => {
    page.signatureCanvas = new ElementRef(canvas());
    draw(page.signatureCanvas.nativeElement);
    const response = new Subject<any>();
    service.registrarFirma.and.returnValue(response);
    spyOn<any>(page, 'canvasBlob').and.resolveTo(new Blob(['test']));
    const first = page.submitSignature();
    await Promise.resolve();
    await page.submitSignature();
    page.clearSignature();
    expect(page.hasSignature).toBeTrue();
    expect(service.registrarFirma).toHaveBeenCalledTimes(1);
    response.next({ result: otp });
    response.complete();
    await first;
  });
});
