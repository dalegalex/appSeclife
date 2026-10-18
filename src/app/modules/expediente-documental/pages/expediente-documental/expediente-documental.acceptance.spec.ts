import { of } from 'rxjs';
import { ExpedienteDocumentalPage } from './expediente-documental.page';
import { DetalleAsignacion, DocumentoFirmante } from '../../models/expediente-documental.model';

describe('Expediente documental: firma y aceptacion', () => {
  let page: ExpedienteDocumentalPage;
  let service: jasmine.SpyObj<any>;
  beforeEach(() => {
    service = jasmine.createSpyObj('service', ['registrarAceptacion', 'registrarFirma']);
    const result = { idotpdesafio: 10, nonce: 'demo', fechaExpiracion: '', destino: 'demo@example.com' };
    service.registrarAceptacion.and.returnValue(of({ result }));
    service.registrarFirma.and.returnValue(of({ result }));
    const toast = { create: async () => ({ present: async () => undefined }) };
    page = new ExpedienteDocumentalPage(service, toast as any, {} as any);
    page.selectedDocument = { idasignacion: 7 } as DocumentoFirmante;
    page.detail = { requiereFirmaGrafica: false } as DetalleAsignacion;
    page.legalAccepted = true;
  });

  it('solicita OTP sin imagen para aceptacion expresa', async () => {
    await page.submitSignature();
    expect(service.registrarAceptacion).toHaveBeenCalledWith(7);
    expect(service.registrarFirma).not.toHaveBeenCalled();
    expect(page.otp?.idotpdesafio).toBe(10);
    expect(page.savingSignature).toBeFalse();
  });

  it('no solicita OTP sin declaracion expresa', async () => {
    page.legalAccepted = false;
    await page.submitSignature();
    expect(service.registrarAceptacion).not.toHaveBeenCalled();
    expect(service.registrarFirma).not.toHaveBeenCalled();
  });

  it('conserva la exigencia de firma cuando corresponde', async () => {
    page.detail!.requiereFirmaGrafica = true;
    await page.submitSignature();
    expect(service.registrarAceptacion).not.toHaveBeenCalled();
    expect(service.registrarFirma).not.toHaveBeenCalled();
  });

  it('envia la imagen por el flujo de firma grafica', async () => {
    const jpeg = new Blob(['demo'], { type: 'image/jpeg' });
    spyOn<any>(page, 'canvasBlob').and.resolveTo(jpeg);
    page.detail!.requiereFirmaGrafica = true;
    page.hasSignature = true;
    await page.submitSignature();
    expect(service.registrarFirma).toHaveBeenCalledWith(7, jpeg);
    expect(service.registrarAceptacion).not.toHaveBeenCalled();
  });
});
