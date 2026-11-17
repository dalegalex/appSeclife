import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ExpedientePreparacionComponent } from './expediente-preparacion.component';
import { ExpedienteDocumentalService } from '../services/expediente-documental.service';

describe('Vista de requisitos familiares', () => {
  it('separa tareas y exporta DOM real con datos sinteticos', async () => {
    await TestBed.configureTestingModule({ imports: [ExpedientePreparacionComponent], providers: [
      { provide: ExpedienteDocumentalService, useValue: {
        preparacionCatalogo: () => of({ codeNumber: 200, result: { habilitado: true, contextoResuelto: true, familia: 'Familia de prueba', idciclo: 202627,
          familias: [{ idfamilia: 1, nombre: 'Familia de prueba' }], ciclos: [{ idfamilia: 1, idciclo: 202627 }] } }),
        preparacion: () => of({ codeNumber: 200, result: { habilitado: true, contextoResuelto: true, familia: 'Familia de prueba', idfamilia: 1, idciclo: 202627,
          asignacionAutomatica: false, consultadoUtc: '2026-11-16T20:00:00Z', documentos: [
            { version: 22, idmatricula: 0, documento: 'CONTRATO DE SERVICIOS', estado: 'FALTAN_DATOS', alumnos: ['Alumna de prueba', 'Alumno de prueba'], pendientes: [
              { responsable: 'FAMILIA', sujeto: 'Representante de prueba', campo: 'Ocupación', donde: 'Expediente Documental > Representación > Datos de contrato', alFirmar: false },
              { responsable: 'FAMILIA', sujeto: 'Alumna de prueba', campo: 'Declaración médica', donde: 'Ficha Médica', alFirmar: false },
              { responsable: 'COLEGIO', sujeto: 'Alumno de prueba', campo: 'Fecha de nacimiento', donde: 'Datos del alumno en el Colegio', alFirmar: false }
            ] },
            { version: 16, idmatricula: 0, documento: 'ACUERDO USO RESPONSABLE Y SEGURO DE DISPOSITIVOS', estado: 'PENDIENTE_ASIGNACION', mensajeAsignacion: 'Falta que el Colegio te asigne este documento. Por ahora toca esperar.', alumnos: ['Alumna de prueba'], pendientes: [
              { responsable: 'COLEGIO', sujeto: 'Colegio', campo: 'Asignar el documento a la familia', donde: 'Administración del Colegio', alFirmar: false }
            ] }
          ] } })
      } }
    ] }).compileComponents();
    const fixture = TestBed.createComponent(ExpedientePreparacionComponent);
    fixture.detectChanges(); await fixture.whenStable();
    await fixture.componentInstance.review(); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector('details')!.open = true;
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(root.textContent).toContain('Por completar en familia');
    expect(root.textContent).toContain('Pendiente del Colegio');
    expect(root.querySelectorAll('article').length).toBe(2);
    expect(root.querySelector('ion-select')).toBeNull();
    expect(root.querySelector('.notice.waiting')?.textContent).toContain('toca esperar');
    expect(root.textContent).not.toContain('La asignación ya existe');
    expect(root.textContent).toContain('Familia de prueba');
    expect(root.textContent).not.toContain('Listo para firmar');
    const clone = (node: Node): Node => {
      const copy = node.cloneNode(false);
      if (node instanceof Element && node.shadowRoot) {
        const template = document.createElement('template'); template.setAttribute('shadowrootmode', 'open');
        node.shadowRoot.childNodes.forEach(child => template.content.appendChild(clone(child)));
        copy.appendChild(template);
      }
      node.childNodes.forEach(child => copy.appendChild(clone(child)));
      return copy;
    };
    const css = Array.from(document.styleSheets).map(s => Array.from(s.cssRules).map(r => r.cssText).join('\n')).join('\n');
    const data = JSON.stringify({ html: (clone(root) as HTMLElement).outerHTML, css });
    const bytes = new TextEncoder().encode(data); let binary = ''; bytes.forEach(b => binary += String.fromCharCode(b));
    console.log('PREPARACION_RENDER:' + btoa(binary));
  });
});
