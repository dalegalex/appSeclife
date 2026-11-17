import {AfterViewInit,Component,ElementRef,EventEmitter,Input,OnDestroy,Output,ViewChild,signal} from '@angular/core';
import {IonicModule} from '@ionic/angular';

@Component({selector:'app-boleta-viewer',standalone:true,imports:[IonicModule],template:`
<ion-header><ion-toolbar><ion-title style="font-size:16px">Boleta de calificaciones</ion-title><ion-buttons slot="end">@if(canShare){<ion-button aria-label="Compartir PDF" title="Compartir PDF" [disabled]="sharing" (click)="shareRequested.emit()">@if(sharing){<ion-spinner name="crescent" aria-label="Preparando PDF" style="width:22px;height:22px" />}@else{<ion-icon name="share-social-outline" />}</ion-button>}<ion-button aria-label="Cerrar boleta" title="Cerrar" (click)="closed.emit()"><ion-icon name="close-outline" /></ion-button></ion-buttons></ion-toolbar></ion-header>
@if(shareError){<p role="alert" style="margin:0;padding:8px 12px;color:#ad2525">{{shareError}}</p>}
<nav aria-label="Controles de la boleta">
 <div class="controls"><button aria-label="Página anterior" title="Página anterior" [disabled]="page()===0" (click)="turn(-1)"><ion-icon name="chevron-back-outline" /></button><output aria-live="polite">{{page()+1}} / {{pages.length}}</output><button aria-label="Página siguiente" title="Página siguiente" [disabled]="page()+1>=pages.length" (click)="turn(1)"><ion-icon name="chevron-forward-outline" /></button></div>
 <div class="controls"><button aria-label="Reducir zoom" title="Reducir zoom" [disabled]="zoom()<=0.5" (click)="resize(zoom()-0.25)"><ion-icon name="remove-outline" /></button><output aria-label="Nivel de zoom">{{percent()}}%</output><button aria-label="Ampliar zoom" title="Ampliar zoom" [disabled]="zoom()>=4" (click)="resize(zoom()+0.25)"><ion-icon name="add-outline" /></button><button aria-label="Ajustar al ancho" title="Ajustar al ancho" (click)="resize(1)"><ion-icon name="scan-outline" /></button></div>
</nav>
<div #viewport class="viewport" tabindex="0" aria-label="Documento de la boleta">
 <img [src]="pages[page()]" [style.width.px]="width()*zoom()" [alt]="'Boleta, página '+(page()+1)" draggable="false" />
</div>`,styles:[`:host{display:flex;flex-direction:column;height:100%;min-height:0;background:white}nav{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:8px;border-bottom:1px solid #d5dce3}.controls{display:flex;align-items:center;gap:5px}button{display:grid;place-items:center;width:36px;height:36px;border:1px solid #adb9c6;border-radius:4px;background:white;color:#1454b8}button:disabled{opacity:.35}button:focus-visible{outline:2px solid #1454b8;outline-offset:2px}button ion-icon{font-size:22px}output{min-width:49px;text-align:center;font-size:13px;font-variant-numeric:tabular-nums}.viewport{flex:1;min-height:0;overflow:auto;background:#dce1e6;overscroll-behavior:contain;padding:12px;touch-action:pan-x pan-y}.viewport img{display:block;max-width:none;height:auto;user-select:none}`]})
export class BoletaViewerComponent implements AfterViewInit,OnDestroy {
 @Input({required:true}) pages:string[]=[];
 @Input() canShare=false;
 @Input() sharing=false;
 @Input() shareError='';
 @Output() shareRequested=new EventEmitter<void>();
 @Output() closed=new EventEmitter<void>();
 @ViewChild('viewport',{static:true}) viewport!:ElementRef<HTMLDivElement>;
 readonly page=signal(0);readonly zoom=signal(1);readonly width=signal(360);
 readonly percent=()=>Math.round(this.zoom()*100);
 private observer?:ResizeObserver;
 private pinch?:{distance:number;zoom:number};
 private frame=0;
 ngAfterViewInit(){const el=this.viewport.nativeElement;this.observer=new ResizeObserver(()=>this.width.set(Math.max(100,el.clientWidth-24)));this.observer.observe(el);el.addEventListener('touchstart',this.start,{passive:false});el.addEventListener('touchmove',this.move,{passive:false});el.addEventListener('touchend',this.end);el.addEventListener('touchcancel',this.end);}
 ngOnDestroy(){this.observer?.disconnect();cancelAnimationFrame(this.frame);const el=this.viewport.nativeElement;el.removeEventListener('touchstart',this.start);el.removeEventListener('touchmove',this.move);el.removeEventListener('touchend',this.end);el.removeEventListener('touchcancel',this.end);}
 turn(delta:number){this.page.update(p=>Math.max(0,Math.min(this.pages.length-1,p+delta)));this.viewport.nativeElement.scrollTo(0,0);}
 resize(value:number,x?:number,y?:number){const el=this.viewport.nativeElement;const next=Math.max(.5,Math.min(4,value));const px=x??el.clientWidth/2,py=y??el.clientHeight/2;const factor=next/this.zoom();const left=(el.scrollLeft+px)*factor-px,top=(el.scrollTop+py)*factor-py;this.zoom.set(next);cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>el.scrollTo(left,top));}
 private distance=(e:TouchEvent)=>Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
 private start=(e:TouchEvent)=>{if(e.touches.length===2){e.preventDefault();this.pinch={distance:Math.max(1,this.distance(e)),zoom:this.zoom()};}};
 private move=(e:TouchEvent)=>{if(e.touches.length===2&&this.pinch){e.preventDefault();const box=this.viewport.nativeElement.getBoundingClientRect();this.resize(this.pinch.zoom*this.distance(e)/this.pinch.distance,(e.touches[0].clientX+e.touches[1].clientX)/2-box.left,(e.touches[0].clientY+e.touches[1].clientY)/2-box.top);}};
 private end=()=>{this.pinch=undefined;};
}
