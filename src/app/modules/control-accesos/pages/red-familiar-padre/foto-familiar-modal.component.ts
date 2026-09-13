import { Component, Input, OnDestroy, OnInit, signal } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { RedFamiliarService } from '../../services/red-familiar.service';

@Component({
  selector: 'app-foto-familiar-modal',
  standalone: true,
  imports: [IonicModule],
  template: `
    <ion-header><ion-toolbar>
      <ion-title>Fotografia del familiar</ion-title>
      <ion-buttons slot="end"><ion-button (click)="cerrar()" aria-label="Cerrar fotografia">
        <ion-icon slot="icon-only" name="close-outline"></ion-icon>
      </ion-button></ion-buttons>
    </ion-toolbar></ion-header>
    <ion-content>
      <section>
        <h2>{{ nombre }}</h2>
        @if (cargando()) {
          <ion-spinner name="crescent" aria-label="Cargando fotografia"></ion-spinner>
        } @else if (error()) {
          <p role="alert">{{ error() }}</p>
        } @else if (foto()) {
          <img [src]="foto()" [alt]="nombre" (error)="imagenFallida()" />
        }
      </section>
    </ion-content>`,
  styles: [`section{padding:16px;text-align:center}h2{font-size:18px;overflow-wrap:anywhere}
    img{display:block;max-width:100%;max-height:70vh;margin:auto;object-fit:contain}p{color:var(--ion-color-danger)}`],
})
export class FotoFamiliarModalComponent implements OnInit, OnDestroy {
  @Input() idorg!: number;
  @Input() idfamilia!: number;
  @Input() idmiembro!: number;
  @Input() nombre = '';
  readonly cargando = signal(true);
  readonly foto = signal<string | null>(null);
  readonly error = signal('');
  private subscription?: Subscription;

  constructor(private readonly service: RedFamiliarService, private readonly modal: ModalController) {}

  ngOnInit(): void {
    this.subscription = this.service.consultarFotoFamiliar(this.idorg, this.idfamilia, this.idmiembro).subscribe({
      next: foto => { this.foto.set(foto); this.cargando.set(false); },
      error: () => { this.error.set('No fue posible consultar la fotografia. Cierra e intenta nuevamente.'); this.cargando.set(false); },
    });
  }

  imagenFallida(): void { this.foto.set(null); this.error.set('No fue posible mostrar la fotografia.'); }
  cerrar(): void { void this.modal.dismiss(); }
  ngOnDestroy(): void { this.subscription?.unsubscribe(); this.foto.set(null); }
}
