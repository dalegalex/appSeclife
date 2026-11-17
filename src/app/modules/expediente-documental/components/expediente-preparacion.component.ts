import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, Optional, signal, ViewRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { PreparacionCatalogo, PreparacionDocumento, PreparacionResultado } from '../models/expediente-preparacion.model';
import { ExpedienteDocumentalService } from '../services/expediente-documental.service';

@Component({
  selector: 'app-expediente-preparacion',
  standalone: true,
  imports: [IonicModule, DatePipe],
  templateUrl: './expediente-preparacion.component.html',
  styleUrls: ['./expediente-preparacion.component.scss'],
})
export class ExpedientePreparacionComponent implements OnInit, OnDestroy {
  readonly catalog = signal<PreparacionCatalogo | null>(null);
  readonly result = signal<PreparacionResultado | null>(null);
  readonly loading = signal(false);
  readonly loadingCatalog = signal(false);
  readonly error = signal('');
  private request = 0;
  private destroyed = false;
  constructor(private readonly service: ExpedienteDocumentalService,
    @Optional() @Inject(ChangeDetectorRef) private readonly changeDetector: ChangeDetectorRef | null = null) {}
  ngOnInit(): void { void this.loadCatalog(); }
  ngOnDestroy(): void { this.destroyed = true; this.request++; }

  async loadCatalog(): Promise<void> {
    this.request++;
    this.result.set(null);
    this.catalog.set(null);
    this.loading.set(false);
    this.loadingCatalog.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.service.preparacionCatalogo());
      if (this.destroyed) return;
      if (response.codeNumber !== 200 || !response.result) throw new Error('Catalogo no disponible');
      this.catalog.set(response.result);
    } catch {
      if (!this.destroyed) this.error.set('No fue posible consultar los requisitos. Tus documentos asignados siguen disponibles.');
    } finally {
      if (!this.destroyed) { this.loadingCatalog.set(false); this.refreshView(); }
    }
  }

  private refreshView(): void {
    if (!this.destroyed && this.changeDetector && !(this.changeDetector as ViewRef).destroyed) this.changeDetector.detectChanges();
  }
  async review(): Promise<void> {
    if (!this.catalog()?.contextoResuelto || this.loading()) return;
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    this.result.set(null);
    this.refreshView();
    try {
      const response = await firstValueFrom(this.service.preparacion());
      if (request !== this.request) return;
      if (response.codeNumber !== 200 || !response.result?.habilitado || !Array.isArray(response.result.documentos)) throw new Error('Respuesta no valida');
      this.catalog.set(response.result);
      if (!response.result.contextoResuelto) return;
      this.result.set(response.result);
    } catch {
      if (request === this.request) this.error.set('No se pudo verificar la preparacion. Vuelve a consultar; no se crearon asignaciones.');
    } finally { if (request === this.request) { this.loading.set(false); this.refreshView(); } }
  }
  pending(item: PreparacionDocumento, owner: 'FAMILIA' | 'COLEGIO') {
    return item.pendientes.filter(x => x.responsable === owner);
  }
  label(state: string): string {
    return ({ FALTAN_DATOS: 'Faltan datos', PENDIENTE_COLEGIO: 'Pendiente del Colegio',
      PENDIENTE_ASIGNACION: 'Pendiente de asignación por el Colegio',
      YA_ASIGNADO: 'Ya asignado', NO_VERIFICADO: 'Consulta incompleta', AUTOMATICO_NO_ACTIVO: 'Automatico aun no activado' } as Record<string, string>)[state] ?? 'Por revisar';
  }
}
