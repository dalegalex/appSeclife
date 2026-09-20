import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit, Optional, computed, signal } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { RedFamiliarService } from '../../services/red-familiar.service';
import { BrigadaSemanalConsulta, BrigadaSemanalFila } from '../../models/brigada-semanal.model';

@Component({
  selector: 'app-brigada-semanal-modal', standalone: true, imports: [IonicModule],
  template: `
    <ion-header><ion-toolbar><ion-title>Brigada semanal</ion-title>
      <ion-buttons slot="end"><ion-button (click)="cerrar()" aria-label="Cerrar brigada"><ion-icon slot="icon-only" name="close-outline"></ion-icon></ion-button></ion-buttons>
    </ion-toolbar></ion-header>
    <ion-content><main>
      <h2>{{ alumno }}</h2>
      @if (cargando()) { <div role="status" class="loading"><ion-spinner name="crescent"></ion-spinner><p>Consultando brigada...</p></div> }
      @else if (error()) { <p role="alert" class="error">{{ error() }}</p><ion-button fill="outline" (click)="cargar()">Reintentar</ion-button> }
      @else if (!datos()?.visible) { <p>La consulta de brigadas no esta disponible.</p> }
      @else {
        <p class="meta">Ciclo escolar {{ datos()?.cicloEscolar || datos()?.idciclo }}</p>
        <p class="meta">Vigencia del ciclo escolar · Hora central de Mexico</p>
        @if (!datos()?.permisosEfectivos) { <p class="notice" role="status">Calendario informativo. Todavia no autoriza la recogida.</p> }
        <ion-segment [value]="dia()" (ionChange)="seleccionarDia($event.detail.value)" [scrollable]="true" aria-label="Dia de la semana">
          @for (nombre of diasCortos; track $index; let i = $index) { <ion-segment-button [value]="i" [attr.aria-label]="dias[i]"><ion-label>{{ nombre }}</ion-label></ion-segment-button> }
        </ion-segment>
        <h3>{{ dias[dia()] }}</h3>
        @for (brigada of filasDelDia(); track brigada.idfila) {
          <section class="family">
            <h4><ion-icon name="people-outline" aria-hidden="true"></ion-icon> {{ brigada.familia }}</h4>
            <p class="state">{{ estado(brigada) }}</p>
            <ul>@for (familiar of brigada.familiares; track familiar.idfamiliamiembro) { <li>{{ familiar.nombre }}</li> }</ul>
            @if (!brigada.familiares.length) { <p>No hay familiares disponibles para mostrar.</p> }
          </section>
        } @empty { <p>Sin brigada semanal registrada para este dia.</p> }
      }
    </main></ion-content>`,
  styles: [`main{padding:16px;max-width:720px;margin:auto}h2{font-size:20px;margin:0 0 12px}h3{font-size:18px}h4{font-size:16px;margin:0}h2,h4,li,p{overflow-wrap:anywhere;letter-spacing:0}ion-segment-button{min-width:44px;--padding-start:6px;--padding-end:6px}.meta{font-size:13px;color:var(--ion-color-medium-shade)}.notice{background:#fff3cd;color:#594100;border-left:3px solid #b98500;padding:12px}.family{padding:16px 0;border-bottom:1px solid var(--ion-color-light-shade)}.state{font-size:14px;color:var(--ion-color-medium-shade)}ul{padding-left:20px}li{margin:8px 0}.error{color:var(--ion-color-danger)}.loading{text-align:center;padding:24px}`],
})
export class BrigadaSemanalModalComponent implements OnInit, OnDestroy {
  @Input() idfamilia!: number;
  @Input() idmatricula!: number;
  @Input() alumno = '';
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly datos = signal<BrigadaSemanalConsulta | null>(null);
  readonly dia = signal(0);
  readonly dias = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
  readonly diasCortos = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  readonly filasDelDia = computed(() => this.datos()?.visible
    ? (this.datos()?.brigadas ?? []).filter(row => (row.dias & (1 << this.dia())) !== 0) : []);
  private subscription?: Subscription;
  private iniciado = false;
  constructor(private readonly service: RedFamiliarService, private readonly modalController: ModalController,
    @Optional() private readonly changeDetector?: ChangeDetectorRef) {}
  ngOnInit(): void { this.iniciar(); }
  // Ionic attaches controller-created views outside Angular's normal input cycle.
  ionViewWillEnter(): void { this.iniciar(); this.changeDetector?.detectChanges(); }
  private iniciar(): void { if (!this.iniciado) { this.iniciado = true; this.cargar(); } }
  cargar(): void {
    this.subscription?.unsubscribe(); this.datos.set(null); this.error.set(''); this.cargando.set(true);
    this.subscription = this.service.consultarBrigadasSemanales(this.idfamilia, this.idmatricula).subscribe({
      next: data => { this.datos.set(data); this.cargando.set(false); this.changeDetector?.detectChanges(); },
      error: () => { this.error.set('No fue posible consultar la brigada. Intenta nuevamente.'); this.cargando.set(false); this.changeDetector?.detectChanges(); },
    });
  }
  seleccionarDia(value: string | number | undefined): void {
    const day = Number(value); if (Number.isInteger(day) && day >= 0 && day < 7) { this.dia.set(day); this.changeDetector?.detectChanges(); }
  }
  estado(row: BrigadaSemanalFila): string {
    if (row.estado === 'ACTIVA' && this.datos()?.permisosEfectivos === true) return 'Activa';
    return row.estado === 'APROBADA_PENDIENTE_ACTIVACION' ? 'Aprobada, pendiente de activacion' : 'En revision';
  }
  cerrar(): void { void this.modalController.dismiss(); }
  ngOnDestroy(): void { this.subscription?.unsubscribe(); this.datos.set(null); }
}
