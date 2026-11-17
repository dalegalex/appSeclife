import {Component,computed,inject,signal,OnDestroy} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {IonicModule} from '@ionic/angular';
import {Capacitor,CapacitorHttp,registerPlugin} from '@capacitor/core';
import {Share} from '@capacitor/share';
import {Directory,Filesystem} from '@capacitor/filesystem';
import {createBoletaPdf,createBoletaDocument} from './boleta-pdf';
import {BoletaViewerComponent} from './boleta-viewer.component';
import {firstValueFrom} from 'rxjs';
import {AuthService} from '../../core/auth/auth.service';
import {environment} from '../../../environments/environment';
import {Report,renderBoletas} from './boletas-report.generated';
const Pdf=registerPlugin<{create(options:{html:string}):Promise<{uri?:string;systemPrint?:boolean}>}>('SeclifeBoletaPdf');
interface Child {idalumnoinscrito:number;idciclo:number;alumno:string;nombre?:string;nombrecompleto?:string;matricula:string;grupo:string;grado:number;unidad:string;disponible:boolean;}
interface Catalog {ciclos:{id:number;descripcion:string}[];alumnos:Child[];}
@Component({selector:'app-calificaciones',standalone:true,imports:[IonicModule,BoletaViewerComponent],template:`
<ion-header><ion-toolbar><ion-buttons slot="start"><ion-back-button defaultHref="/home" /></ion-buttons><ion-title>Calificaciones</ion-title></ion-toolbar></ion-header>
<ion-content><main>
<label>Ciclo escolar<select aria-label="Ciclo escolar" [value]="cycle()" [disabled]="busy()" (change)="changeCycle(+$any($event.target).value)">@for(c of catalog().ciclos;track c.id){<option [value]="c.id">{{c.descripcion}}</option>}</select></label>
<ion-segment [scrollable]="true" [value]="selected()" (ionChange)="select(+$any($event.detail.value))" aria-label="Hijos">@for(a of children();track a.idalumnoinscrito){<ion-segment-button [disabled]="busy()" [value]="a.idalumnoinscrito"><ion-label>{{a.nombre || a.alumno}}</ion-label></ion-segment-button>}</ion-segment>
@if(error()){<p class="error" role="alert">{{error()}}</p>}
@if(busy()){<p role="status"><ion-spinner name="crescent" /> Generando / consultando…</p>}
@if(child();as a){<section><div class="student-details"><h2>{{a.nombrecompleto || a.alumno}}</h2><p>{{a.matricula}} · {{a.unidad}}</p><p>{{a.grupo}} · Grado {{a.grado}}</p></div>
@if(!a.disponible){<p>El Colegio aún no ha publicado la boleta.</p>}
<ion-button [disabled]="busy()||!a.disponible" (click)="generate()">Ver boleta PDF</ion-button>
@if(native()){<ion-button fill="outline" [disabled]="busy()||!a.disponible" (click)="share()"><ion-icon slot="start" name="share-social-outline" />Compartir PDF</ion-button>}
</section>}@else if(!busy()){<p>No hay hijos inscritos para el ciclo seleccionado.</p>}
<ion-button fill="clear" [disabled]="busy()" (click)="load()">Actualizar</ion-button>
</main></ion-content>
<ion-modal [isOpen]="previewPages().length>0" (didDismiss)="previewPages.set([])" style="--width:100%;--height:100%;--border-radius:0"><ng-template><app-boleta-viewer [pages]="previewPages()" [canShare]="native()" [sharing]="busy()" [shareError]="error()" (shareRequested)="share()" (closed)="previewPages.set([])" /></ng-template></ion-modal>`,styles:[`main{max-width:900px;margin:auto;padding:20px}label{display:grid;gap:8px}select{padding:12px;border:1px solid #b7c6d4;border-radius:4px;background:white;color:#162b3d}ion-segment{margin:20px 0}section{border-top:1px solid #d6e0e8;padding-top:16px}h2{font-size:19px;overflow-wrap:anywhere}p{line-height:1.5}.student-details{display:grid;gap:3px;margin-bottom:20px}.student-details h2,.student-details p{margin:0;line-height:1.25}.error{color:#ad2525}ion-spinner{width:20px;height:20px;vertical-align:middle}`]})
export class CalificacionesPage implements OnDestroy {
 readonly android=()=>Capacitor.getPlatform()==='android';
 readonly native=()=>Capacitor.isNativePlatform();
 readonly previewPages=signal<string[]>([]);
 private http=inject(HttpClient);private auth=inject(AuthService);private seq=0;
 private base=(Capacitor.isNativePlatform()?environment.androidApiUrl:environment.apiUrl);
 readonly catalog=signal<Catalog>({ciclos:[],alumnos:[]});readonly cycle=signal(0);readonly selected=signal(0);readonly busy=signal(false);readonly error=signal('');readonly pdfUri=signal('');
 readonly children=computed(()=>this.catalog().alumnos.filter(a=>a.idciclo===this.cycle()));readonly child=computed(()=>this.children().find(a=>a.idalumnoinscrito===this.selected()));
 constructor(){void this.load();}
 ngOnDestroy(){++this.seq;this.pdfUri.set('');this.previewPages.set([]);}
 private async get<T>(path:string):Promise<T>{const token=this.auth.getToken();if(!token)throw new Error('Inicia sesión nuevamente.');const url=this.base+path;
 if(Capacitor.isNativePlatform()){const r=await CapacitorHttp.get({url,headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},responseType:'json'});if(r.status<200||r.status>=300)throw new Error(r.data?.message??'No fue posible consultar la boleta.');return r.data;}
 return firstValueFrom(this.http.get<T>(url));}
 async load(){const seq=++this.seq;this.busy.set(true);this.error.set('');this.pdfUri.set('');try{const r=await this.get<{result:Catalog}>('/evaluaciones/boletas/familia/catalogos');if(seq!==this.seq)return;this.catalog.set(r.result);if(!r.result.ciclos.some(c=>c.id===this.cycle()))this.cycle.set(r.result.ciclos[0]?.id??0);this.selected.set(this.children()[0]?.idalumnoinscrito??0);}catch(e:any){if(seq===this.seq){this.catalog.set({ciclos:[],alumnos:[]});this.error.set(e.error?.message??e.message);}}finally{if(seq===this.seq)this.busy.set(false);}}
 changeCycle(id:number){++this.seq;this.cycle.set(id);this.selected.set(this.children()[0]?.idalumnoinscrito??0);this.pdfUri.set('');this.error.set('');}
 select(id:number){this.selected.set(id);this.pdfUri.set('');this.error.set('');}
 async generate(sharing=false){const child=this.child();if(!child||!child.disponible||this.busy())return;const seq=++this.seq;this.busy.set(true);this.error.set('');this.pdfUri.set('');if(!sharing)this.previewPages.set([]);try{
 const r=await this.get<{result:Report}>(`/evaluaciones/boletas/familia/${child.idalumnoinscrito}?idciclo=${this.cycle()}`);
 const brand=await this.get<{logoorg?:string;logoContentType?:string}>('/auth/organizacion/identidad');if(seq!==this.seq)return;
 const raw=brand.logoorg?.trim();const logo=raw?(raw.startsWith('data:')||raw.startsWith('https://')?raw:`data:${brand.logoContentType||'image/png'};base64,${raw}`):null;
 const html=renderBoletas(r.result,logo,false).html;
 if(!sharing){const document=await createBoletaDocument(html);if(seq===this.seq)this.previewPages.set(document.pages);}
 else if(Capacitor.isNativePlatform()){
 const pdf=sharing&&this.android()?await this.createShareFile(html):await Pdf.create({html});
 if(seq!==this.seq)return;
 if(pdf.uri){this.pdfUri.set(pdf.uri);await Share.share({title:'Boleta de calificaciones',files:[pdf.uri]});}
 }
 }catch(e:any){if(seq===this.seq)this.error.set(e.error?.message??e.message??'No fue posible generar la boleta.');}finally{if(seq===this.seq)this.busy.set(false);}}
 async share(){await this.generate(true);}
 private async createShareFile(html:string):Promise<{uri:string}>{
 const pdf=await createBoletaPdf(html);
 const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('No fue posible preparar el PDF.'));reader.readAsDataURL(pdf);});
 const folder='boletas-compartidas';
 try{const old=await Filesystem.readdir({path:folder,directory:Directory.Cache});for(const file of old.files){if(file.type==='file'&&file.mtime<Date.now()-86400000)await Filesystem.deleteFile({path:`${folder}/${file.name}`,directory:Directory.Cache});}}catch{/* Cache may not exist yet. */}
 return Filesystem.writeFile({path:`${folder}/Boleta-${crypto.randomUUID()}.pdf`,data,directory:Directory.Cache,recursive:true});
 }
}
