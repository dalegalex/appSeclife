import { FileOpener } from '@capawesome-team/capacitor-file-opener';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Component, OnInit, inject, signal, LOCALE_ID, DestroyRef } from '@angular/core';
import { DatePipe, registerLocaleData } from '@angular/common';
import localeEsMx from '@angular/common/locales/es-MX';
registerLocaleData(localeEsMx);
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { IonicModule, ToastController } from '@ionic/angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RedFamiliarService } from '../control-accesos/services/red-familiar.service';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../environments/environment';
interface Envelope<T>{result:T;message:string;codeNumber:number;}
interface Alumno{idmatricula:number;matricula:string;nombre:string;nombreCorto?:string;}
interface Ficha{referencia:Record<string,string|null>;adicionales:Record<string,string|boolean|number|string[]|null>;grupoSanguineo:string|null;revision:string;
 bloques:Record<string,boolean>;aviso:string;privacidad:string;zonaHoraria:string;puedeCrear:boolean;puedeEditar:boolean;puedeComunicar:boolean;
 autorizacion:{estado:string;referencia?:string};legacy:Record<string,string>;declaracion?:{fecha_declaracion?:string};}
interface Incidente{id:number;fechaIncidente:string;sintomas:string;acciones:string;resultado:string;profesional:string;comunicado?:string;
 receptor?:string;destino?:string;autorizacion:{estado:string};aclaraciones:{texto:string;fecha:string}[];contactos:{persona:string;resultado:string;fecha:string}[];}
interface Adjunto{id:number;tipo:string;nombre:string;contentType?:string;}
@Component({selector:'app-ficha-medica',standalone:true,providers:[{provide:LOCALE_ID,useValue:'es-MX'}],imports:[ReactiveFormsModule,DatePipe,IonicModule],template:`
<ion-header><ion-toolbar><ion-buttons slot="start"><ion-back-button defaultHref="/home"></ion-back-button></ion-buttons><ion-title>Ficha Médica</ion-title></ion-toolbar></ion-header><ion-content>
<section class="medica">
<header><h1>Ficha Médica</h1><p>{{family ? 'Antecedentes de tus hijos y avisos del Colegio.' : 'Referencia familiar y registro de incidentes de salud escolar.'}}</p></header>
@if(error()){<p class="error" role="alert">{{error()}}</p>}
@if(notice()){<p class="notice" role="status">{{notice()}}</p>}
<p>Selecciona a tu hijo para consultar su información médica y los comunicados del Colegio.</p>
<div class="layout"><nav class="student-selector" aria-label="Alumnos">
<ion-segment [scrollable]="true" [value]="selected()?.idmatricula" (ionChange)="selectStudent($event.detail.value)" aria-label="Seleccionar alumno">
@for(a of alumnos();track a.idmatricula){<ion-segment-button [value]="a.idmatricula" [disabled]="busy()"><ion-label>{{a.nombreCorto || a.nombre}}</ion-label></ion-segment-button>}
</ion-segment>
@if(!loading() && alumnos().length===0){<p>No hay alumnos disponibles para esta consulta.</p>}
@if(more()){<button (click)="loadMore()" [disabled]="loading()">Más alumnos</button>}
</nav><main>
@if(loading()){<p role="status">Consultando…</p>}
@if(ficha();as f){
<h2>{{selected()?.nombreCorto || selected()?.nombre}}</h2>
<ion-segment class="medical-tabs" [value]="activeTab()" (ionChange)="changeTab($event.detail.value)" aria-label="Secciones de ficha médica">
<ion-segment-button value="info"><ion-label>INFO.MEDICA</ion-label></ion-segment-button>
<ion-segment-button value="comunicados"><ion-label>COMUNICADOS</ion-label></ion-segment-button>
<ion-segment-button value="receta"><ion-label>RECETA EXT.</ion-label></ion-segment-button>
</ion-segment>
@if(activeTab()==='info'){
@if(f.declaracion?.fecha_declaracion){<p class="reference">Última actualización: {{f.declaracion?.fecha_declaracion | date:'medium'}}</p>}
<p class="warning">{{authorizationLabel(f.autorizacion.estado)}} @if(f.autorizacion.referencia){— {{f.autorizacion.referencia}}}</p>
@if(family){@if(f.aviso){<p>{{f.aviso}}</p>}@if(f.privacidad){<p>{{f.privacidad}}</p>}}
<form [formGroup]="form" (ngSubmit)="save()" novalidate>
<p class="reference">Las preguntas con * son obligatorias. En los campos de texto, escribe NO APLICA o NINGUNO cuando corresponda.</p>
<section class="form-section"><h3>Tipo de sangre</h3>
<ion-item lines="none" [class.invalid-field]="showFieldError('grupoSanguineo')"><div class="medical-field"><div class="field-label">Grupo sanguíneo y factor Rh *</div><ion-select aria-label="Grupo sanguíneo y factor Rh" formControlName="grupoSanguineo" interface="alert" placeholder="Seleccionar" cancelText="Cancelar" okText="Aceptar">
<ion-select-option value="NO_INFORMADO">No lo sé / no informado</ion-select-option>@for(g of groups;track g){<ion-select-option [value]="g">{{g}}</ion-select-option>}
</ion-select>@if(showFieldError('grupoSanguineo')){<p class="field-error" role="alert">Selecciona una respuesta; si lo desconoces, elige No lo sé.</p>}</div></ion-item>
@if(f.legacy['tipoSangreFicha'] || f.legacy['tipoSangreCredencial']){<p class="reference">Dato anterior: {{f.legacy['tipoSangreFicha'] || f.legacy['tipoSangreCredencial']}}. Confirma el dato antes de guardar.</p>}
</section>
@for(section of sections;track section.title){@if(section.block!=='tratamiento' && (!section.block || f.bloques[section.block])){
<section class="form-section"><h3>{{section.title}}</h3><p class="reference">{{section.hint}}</p><div class="fields">
@for(field of sectionFields(section.keys);track field.key){@if(field.key!=='otroPadecimiento' || selectedDiseases().includes('OTRA')){<ion-item lines="none" [class.invalid-field]="showFieldError(field.key)"><div class="medical-field">
@if(field.type!=='checklist'){<div class="field-label">{{field.label}}@if(isRequired(field.key)){<span aria-hidden="true"> *</span>}</div>}
@if(field.type==='checklist'){
<div class="disease-checklist"><p class="field-label">{{field.label}}</p>
@for(d of diseases;track d.code){<ion-checkbox labelPlacement="end" justify="start" [checked]="selectedDiseases().includes(d.code)" [disabled]="busy() || !f.puedeEditar" (ionChange)="toggleDisease(d.code,$event.detail.checked)">{{d.label}}</ion-checkbox>}
</div>
}@else if(field.type==='number'){
<ion-input type="number" inputmode="decimal" [attr.aria-label]="field.label" [formControlName]="field.key" min="0.01" [max]="field.key==='pesoFamiliarKg'?500:250" step="0.01" placeholder="No informado"></ion-input>
}@else if(field.key.endsWith('Parentesco')){
<ion-select [attr.aria-label]="field.label" [formControlName]="field.key" interface="alert" placeholder="Seleccionar parentesco" cancelText="Cancelar" okText="Aceptar">
<ion-select-option value="">No informado</ion-select-option>
@for(p of parentescos();track p){<ion-select-option [value]="p">{{p}}</ion-select-option>}
@if(previousParentesco(field.key);as previous){<ion-select-option [value]="previous">{{previous}} (registrado anteriormente)</ion-select-option>}
</ion-select>
}@else if(field.type==='pain'){
<ion-select [attr.aria-label]="field.label" [formControlName]="field.key" interface="alert" placeholder="Seleccionar" cancelText="Cancelar" okText="Aceptar">
<ion-select-option value="">No informado</ion-select-option><ion-select-option value="ALTO">Alto</ion-select-option><ion-select-option value="MEDIO">Medio</ion-select-option><ion-select-option value="BAJO">Bajo</ion-select-option></ion-select>
}@else if(field.type==='boolean'){
<ion-select [attr.aria-label]="field.label" [formControlName]="field.key" interface="alert" placeholder="Seleccionar" cancelText="Cancelar" okText="Aceptar"><ion-select-option value="">No informado</ion-select-option><ion-select-option value="true">Sí</ion-select-option><ion-select-option value="false">No</ion-select-option></ion-select>
}@else if(field.type==='date'){
<ion-input type="date" [attr.aria-label]="field.label" [formControlName]="field.key"></ion-input>
}@else if(isShortField(field.key)){
<ion-input [type]="isPhone(field.key)?'tel':'text'" [attr.aria-label]="field.label" [formControlName]="field.key" [maxlength]="field.max" (ionInput)="uppercaseInput(field.key,$event.detail.value)" [placeholder]="isPhone(field.key)?'Número con lada':'Escribe aquí'"></ion-input>
}@else{
<ion-textarea [attr.aria-label]="field.label" [formControlName]="field.key" [maxlength]="field.max" (ionInput)="uppercaseInput(field.key,$event.detail.value)" [autoGrow]="true" rows="2" placeholder="Escribe la información; si no aplica, indícalo"></ion-textarea>
}@if(showFieldError(field.key)){<p class="field-error" role="alert">{{fieldErrorMessage(field.key)}}</p>}</div></ion-item>
@if(field.key==='medicamentosAutorizados'){<p class="reference">Declaración del familiar. No acredita por sí sola el consentimiento legal ni constituye una indicación médica.</p>}
}}
</div>
@if(section.block){
<ion-button type="button" (click)="choosePhoto(section.block==='vacunacion'?'CARTILLA':'RECETA',true)" [disabled]="busy() || !f.puedeEditar">Cámara</ion-button>
<ion-button type="button" fill="outline" (click)="choosePhoto(section.block==='vacunacion'?'CARTILLA':'RECETA',false)" [disabled]="busy() || !f.puedeEditar">Galería / archivo</ion-button>
<p class="reference">Imagen JPG/PNG o archivo PDF, hasta 5 MB.</p>
@for(a of adjuntos();track a.id){@if(a.tipo===(section.block==='vacunacion'?'CARTILLA':'RECETA')){
<div class="attachment"><span>{{a.nombre}}</span><button type="button" (click)="openImage(a)" [disabled]="busy()">Consultar</button><button type="button" (click)="retire(a)" [disabled]="busy() || !f.puedeEditar">Retirar</button></div>
}}
}
</section>
}}
<p class="reference">La receta y el tratamiento externo son informativos. No constituyen autorización para administrar medicamentos.</p>
<ion-button type="submit" expand="block" [disabled]="busy() || loading() || !f.puedeEditar">Guardar ficha médica</ion-button>
</form>
<details><summary>Información registrada anteriormente</summary>
<p>Información de referencia de la ficha anterior. Revisa los datos antes de guardar este formulario.</p>
@for(item of legacyFields;track item.key){<p><strong>{{item.label}}:</strong> {{f.legacy[item.key] || 'No informado'}}</p>}
</details>
@if(imageUrl()){<section><button type="button" (click)="closeImage()">Cerrar imagen</button><img class="preview" [src]="imageUrl()" alt="Documento médico proporcionado por el familiar"></section>}
@if(!family && f.puedeCrear){
<section id="registro-incidente"><h3>Registrar incidente escolar</h3><p>Describa lo observado y lo realizado. Este registro no emite recetas ni diagnósticos.</p>
<form [formGroup]="incidentForm" (ngSubmit)="register()"><div class="fields">
<label>Fecha y hora del incidente (hora de este dispositivo)<input type="datetime-local" formControlName="fechaIncidente"></label>
<label>Síntomas y situación presentada<textarea formControlName="sintomas" maxlength="3000" rows="4"></textarea></label>
<label>Atención y acciones realizadas<textarea formControlName="acciones" maxlength="3000" rows="4"></textarea></label>
<label>Resultado<select formControlName="resultado">@for(r of outcomes;track r.key){<option [value]="r.key">{{r.label}}</option>}</select></label>
<label>Persona que recibe al alumno<input formControlName="receptor" maxlength="200"></label>
<label>Destino de canalización<input formControlName="destino" maxlength="300"></label>
<label>Fecha y hora del resultado<input type="datetime-local" formControlName="fechaResultado"></label>
<label>Peso medido (kg)<input type="number" formControlName="pesoKg" min="0.01" max="500" step="0.01"></label>
<label>Estatura medida (cm)<input type="number" formControlName="estaturaCm" min="0.01" max="250" step="0.01"></label>
<label>Fecha y hora de medición<input type="datetime-local" formControlName="fechaMedicion"></label>
<label>Motivo si alguna medición no se realizó<input formControlName="motivoNoMedicion" maxlength="300"></label>
</div><p>El registro queda confirmado. Las correcciones se agregan como aclaraciones. Registrar una entrega no autoriza la salida en Control de Accesos.</p>
<button [disabled]="busy() || incidentForm.invalid">Registrar incidente</button></form></section>}
@if(!family && f.puedeEditar){<details><summary>Registrar referencia de autorización externa</summary>
<form [formGroup]="authForm" (ngSubmit)="saveAuthorization()"><div class="fields">
<label>Estado<select formControlName="estado"><option value="EXTERNA_DECLARADA">Custodiada por el Colegio</option><option value="NO_ACREDITADA">No acreditada</option><option value="RECHAZADA">Rechazada</option><option value="REVOCADA">Revocada</option><option value="VENCIDA">Vencida</option></select></label>
<label>Documento, folio, ubicación y alcance<textarea formControlName="referencia" maxlength="500"></textarea></label>
<label>Representante firmante<input formControlName="representante" maxlength="200"></label>
<label>Fecha del documento<input type="date" formControlName="fechaDocumento"></label><label>Vigente hasta<input type="date" formControlName="vigenteHasta"></label>
</div><button [disabled]="busy() || authForm.invalid">Registrar referencia</button></form></details>}
}
@if(activeTab()==='receta'){
<section><h3>Receta o documento médico externo</h3>
<p class="reference">Solo para conocimiento del Colegio. No acredita vigencia ni autoriza administrar medicamentos.</p>
@if(f.bloques['tratamiento']){
<ion-button type="button" (click)="choosePhoto('RECETA',true)" [disabled]="busy() || !f.puedeEditar">Cámara</ion-button>
<ion-button type="button" fill="outline" (click)="choosePhoto('RECETA',false)" [disabled]="busy() || !f.puedeEditar">Galería / archivo</ion-button>
<p class="reference">Imagen JPG/PNG o archivo PDF, hasta 5 MB.</p>
@for(a of adjuntos();track a.id){@if(a.tipo==='RECETA'){
<div class="attachment"><span>{{a.nombre}}</span><button type="button" (click)="openImage(a)" [disabled]="busy()">Consultar</button><button type="button" (click)="retire(a)" [disabled]="busy() || !f.puedeEditar">Retirar</button></div>
}}
@if(!hasExternalDocument()){<p>No se ha adjuntado un documento médico externo.</p>}
}@else{<p>El Colegio no ha habilitado este bloque.</p>}
@if(imageUrl()){<button type="button" (click)="closeImage()">Cerrar imagen</button><img class="preview" [src]="imageUrl()" alt="Documento médico externo proporcionado por el familiar">}
</section>
}
@if(activeTab()==='comunicados'){
<section><h3>Incidentes {{family?'comunicados':''}}</h3>
@for(i of incidentes();track i.id){<article><h4>{{i.fechaIncidente | date:'medium'}} — {{i.profesional}}</h4>
<p class="warning">{{authorizationLabel(i.autorizacion.estado)}}</p><p><strong>Síntomas:</strong> {{i.sintomas}}</p><p><strong>Acciones:</strong> {{i.acciones}}</p>
<p><strong>Resultado:</strong> {{outcome(i.resultado)}} {{i.receptor}} {{i.destino}}</p>
@for(a of i.aclaraciones;track $index){<p><strong>Aclaración {{a.fecha | date:'medium'}}:</strong> {{a.texto}}</p>}
@for(c of i.contactos;track $index){<p>Contacto: {{c.persona}} — {{c.resultado}} ({{c.fecha | date:'medium'}})</p>}
@if(!family){<p>{{i.comunicado?'Disponible para la familia':'Pendiente de comunicar'}}</p>
@if(f.puedeComunicar){<button (click)="communicate(i)" [disabled]="busy()">{{i.comunicado?'Reintentar aviso':'Comunicar a la familia'}}</button>}
@if(f.puedeEditar){<button (click)="editIncident.set(i.id)" [disabled]="busy()">Agregar aclaración o contacto</button>}
@if(editIncident()===i.id){<form [formGroup]="noteForm" (ngSubmit)="clarify(i)"><label>Aclaración<textarea formControlName="texto" maxlength="2000"></textarea></label><button [disabled]="busy() || noteForm.invalid">Guardar aclaración</button></form>
<form [formGroup]="contactForm" (ngSubmit)="contact(i)"><label>Persona contactada<input formControlName="persona" maxlength="200"></label><label>Canal<select formControlName="canal"><option value="TELEFONO">Teléfono</option><option value="PRESENCIAL">Presencial</option><option value="OTRO">Otro</option></select></label><label>Resultado<select formControlName="resultado"><option value="SIN_RESPUESTA">Sin respuesta</option><option value="CONTACTADO">Contactado</option></select></label><label>Fecha y hora<input type="datetime-local" formControlName="fecha"></label><button [disabled]="busy() || contactForm.invalid || !f.puedeCrear">Registrar contacto</button></form>}}
</article>}
@if(incidentes().length===0){<p>No hay incidentes disponibles.</p>}
@if(moreIncidents()){<button (click)="loadIncidents(true)" [disabled]="busy()">Más incidentes</button>}
<p class="reference">Un aviso enviado o leído no sustituye el contacto efectivo con la familia.</p>
</section>
}
}
</main></div></section>
</ion-content>
`,styles:[`
:host{display:block}.medica{max-width:1250px;margin:auto;padding:24px;color:#17324b;background:#f6f8fb}h1{font-size:1.7rem}h2{font-size:1.4rem}h3{font-size:1.2rem}p{white-space:pre-wrap;overflow-wrap:anywhere}.layout{display:grid;grid-template-columns:240px 1fr;gap:24px}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}label{display:flex;flex-direction:column;gap:6px;font-weight:500;margin:10px 0}input,textarea,select{width:100%;box-sizing:border-box;padding:10px;border:1px solid #adbcc9;border-radius:7px;background:white;color:#17324b;font:inherit}button{padding:10px 16px;border:1px solid #176b77;border-radius:7px;background:#fff;color:#176b77;cursor:pointer;margin:5px}button:disabled{opacity:.5;cursor:default}.student{display:block;width:100%;text-align:left}.student.active{background:#dceff0}.student small{display:block}.search{display:flex;align-items:center;gap:12px}.search label{flex:1}.warning{background:#fff4d5;padding:12px;border-radius:8px}.error{background:#fee6e5;padding:12px}.notice{background:#dff3e6;padding:12px}.reference{font-size:.9rem;color:#52687a}section section,details,article{padding:16px;margin:18px 0;background:#fff;border:1px solid #dce4eb;border-radius:10px}.attachment{display:flex;align-items:center;flex-wrap:wrap}.preview{display:block;max-width:100%;max-height:70vh;object-fit:contain}main{min-width:0}@media(max-width:760px){.medica{padding:12px}.layout{grid-template-columns:1fr}.fields{grid-template-columns:1fr}aside{max-height:200px;overflow:auto}}
ion-content{--background:#f4f8fc}.medica{max-width:760px;margin:auto}.layout{display:block}aside{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0;max-height:none!important}.student{width:auto;border-radius:24px}.student.active{background:#126b60;color:#fff}.fields{grid-template-columns:1fr}ion-item{--background:#f8fafc;--padding-start:12px;--inner-padding-end:12px;border:1px solid #d4dee8;border-radius:8px;--min-height:68px;margin:4px 0}ion-input,ion-select,ion-textarea{width:100%;font-size:16px}.form-section h3{margin:0 0 10px}.form-section{padding:16px!important}

.disease-checklist{width:100%;padding:10px 0}.disease-checklist ion-checkbox{display:block;margin:14px 0;--size:22px}.disease-checklist ion-checkbox::part(label){white-space:normal;line-height:1.45}.field-error{color:#b42318!important}.medical-field p.field-error{font-size:13px;margin:6px 0 0}
.field-label{font-weight:600;font-size:14px;white-space:normal;line-height:1.5;overflow-wrap:anywhere}.medical-field{width:100%;padding:14px 0}.medical-field ion-textarea{--padding-top:8px}
:host{display:flex;flex-direction:column;height:100%;min-height:0}ion-content{flex:1;--background:#f6f8fb;--padding-bottom:calc(32px + env(safe-area-inset-bottom,0px))}
.medica{padding-bottom:calc(40px + env(safe-area-inset-bottom,0px))!important}section section,details,article{border-radius:16px;box-shadow:0 10px 28px rgba(15,23,42,.08)}
.fields{gap:0}ion-item{--background:#fff;border:none;border-bottom:1px solid #e6eaf0;border-radius:0}
ion-input::part(native),ion-textarea::part(native){text-transform:uppercase}
.student-selector{margin:16px 0}.student-selector ion-segment,.medical-tabs{background:#fff;border-radius:14px;box-shadow:0 8px 24px rgba(15,23,42,.08);margin-bottom:12px;width:100%}
.medical-tabs ion-segment-button{min-width:0;flex:1;font-size:12px;--padding-start:6px;--padding-end:6px}
.children{background:white;border-radius:14px}h2{padding:16px;border-radius:18px;background:linear-gradient(135deg,#155e75,#16a34a);color:white;font-size:1.18rem;box-shadow:0 14px 34px rgba(15,23,42,.18)}
`]})
export class FichaMedicaPage implements OnInit {
 readonly validationAttempted=signal(false);
 readonly requiredKeys=new Set(['grupoSanguineo','umbralDolor','alergias','anafilaxia','fechaAnafilaxia','restriccionMedicamentos','participaActividades','restriccionActividades','contacto1Nombre','contacto1Parentesco','contacto1Telefono','seguro_medico','poliza_seguro','medicamentosAutorizados']);
 isRequired(key:string){return (this.requiredKeys.has(key) || (key==='tratamientoActual' && this.selectedDiseases().length>0) || (key==='otroPadecimiento' && this.selectedDiseases().includes('OTRA'))) && this.form.get(key)?.enabled===true;}
 showFieldError(key:string){const control=this.form.get(key);return !!control?.enabled && control.invalid && (control.touched || this.validationAttempted());}
 fieldErrorMessage(key:string){const control=this.form.get(key);if(control?.hasError('required') || (this.isRequired(key)&&control?.hasError('pattern')))return 'Responde esta pregunta. En texto puedes indicar NO APLICA o NINGUNO.';return 'Revisa el formato o el límite permitido para este dato.';}
 private fieldValidators(key:string,max:number){
 const validators=key==='pesoFamiliarKg'||key==='estaturaFamiliarCm'?[Validators.min(0.01),Validators.max(key==='pesoFamiliarKg'?500:250),Validators.pattern(/^\d+(?:\.\d{1,2})?$/)]:[Validators.maxLength(max)];
 if(this.requiredKeys.has(key))validators.push(Validators.required,Validators.pattern(/\S/));
 return validators;
 }
 readonly selectedDiseases=signal<string[]>([]);
 toggleDisease(code:string,checked:boolean){
 if(this.busy() || !this.ficha()?.puedeEditar)return;
 this.selectedDiseases.update(old=>checked?[...new Set([...old,code])]:old.filter(v=>v!==code));this.syncOtherDisease();
 }
 private syncOtherDisease(){const treatment=this.form.get('tratamientoActual')!;
 treatment.setValidators(this.selectedDiseases().length>0?[Validators.required,Validators.pattern(/\S/),Validators.maxLength(3000)]:[Validators.maxLength(3000)]);treatment.updateValueAndValidity({emitEvent:false});
 const control=this.form.get('otroPadecimiento')!;
 control.setValidators(this.selectedDiseases().includes('OTRA')?[Validators.required,Validators.pattern(/\S/),Validators.maxLength(1000)]:[Validators.maxLength(1000)]);
 if(!this.selectedDiseases().includes('OTRA'))control.setValue('',{emitEvent:false});control.updateValueAndValidity({emitEvent:false});}
 readonly activeTab=signal<'info'|'comunicados'|'receta'>('info');
 changeTab(value:string|number|undefined){if(value==='info'||value==='comunicados'||value==='receta'){this.closeImage();this.activeTab.set(value);}}
 hasExternalDocument(){return this.adjuntos().some(a=>a.tipo==='RECETA');}
 async selectStudent(value:string|number|undefined){const alumno=this.alumnos().find(a=>a.idmatricula===Number(value));if(alumno&&alumno.idmatricula!==this.selected()?.idmatricula)await this.select(alumno);}
 readonly family=true;private readonly http=inject(HttpClient);private readonly fb=inject(FormBuilder);
 private readonly toastController=inject(ToastController);
 private readonly destroyRef=inject(DestroyRef);private readonly redFamiliar=inject(RedFamiliarService);
 readonly parentescos=signal<string[]>([]);
 async loadParentescos(){try{const catalog=await firstValueFrom(this.redFamiliar.consultarCatalogos());this.parentescos.set([...new Set((catalog.parentescos??[]).map(p=>(p.descripcion??p.nombre??'').trim().toUpperCase()).filter(Boolean))]);}catch{this.error.set('No fue posible cargar los parentescos. Vuelve a abrir la ficha para reintentar.');}}
 previousParentesco(key:string){const value=this.form.get(key)?.value??'';return value&&!this.parentescos().includes(value)?value:null;}
 uppercaseInput(key:string,value:string|null|undefined){this.form.get(key)?.setValue((value??'').toUpperCase(),{emitEvent:false});}
 private syncDependentFields(){
 for(const [key,enabled] of [['fechaAnafilaxia',this.form.get('anafilaxia')?.value==='true'],['restriccionActividades',this.form.get('participaActividades')?.value==='false']] as const){
 const control=this.form.get(key)!;if(enabled&&this.ficha()?.puedeEditar)control.enable({emitEvent:false});else control.disable({emitEvent:false});
 }}
 private documentInput:HTMLInputElement|null=null;
 choosePhoto(tipo:string,camera:boolean){
 if(this.busy() || !this.ficha()?.puedeEditar)return;
 this.documentInput?.remove();
 const generation=this.generation;
 const input=document.createElement('input');input.type='file';input.accept=camera?'image/jpeg,image/png':'image/jpeg,image/png,application/pdf,.pdf';
 if(camera)input.setAttribute('capture','environment');
 input.style.position='fixed';input.style.left='-9999px';input.style.opacity='0';
 this.documentInput=input;
 const cleanup=()=>{input.remove();if(this.documentInput===input)this.documentInput=null;};
 input.addEventListener('cancel',cleanup,{once:true});
 input.onchange=async()=>{
 try{const file=input.files?.[0];if(file&&generation===this.generation)await this.run(()=>this.uploadFile(file,tipo));}
 finally{cleanup();}
 };
 document.body.appendChild(input);input.click();
 }
 private async uploadFile(file:File,tipo:string){
 const mime=file.type || (file.name.toLowerCase().endsWith('.pdf')?'application/pdf':'');
 if(file.size<=0 || file.size>5242880 || !['image/jpeg','image/png','application/pdf'].includes(mime))throw new Error('Seleccione JPG, PNG o PDF de hasta 5 MB.');
 // Materializar el archivo del selector antes de enviar; no depender de la URI temporal del proveedor Android.
 const bytes=await new Promise<ArrayBuffer>((resolve,reject)=>{
 const reader=new FileReader();
 reader.onload=()=>reader.result instanceof ArrayBuffer?resolve(reader.result):reject(new Error('No fue posible leer el archivo seleccionado.'));
 reader.onerror=()=>reject(new Error('No fue posible leer el archivo. Descárgalo al teléfono y selecciónalo nuevamente.'));
 reader.onabort=()=>reject(new Error('Se canceló la lectura del archivo.'));
 reader.readAsArrayBuffer(file);
 });
 if(bytes.byteLength===0 || bytes.byteLength>5242880)throw new Error('El archivo está vacío o excede 5 MB.');
 const body=new FormData();body.append('archivo',new Blob([bytes],{type:mime}),file.name);body.append('tipo',tipo);body.append('solicitud',crypto.randomUUID());
 try{await firstValueFrom(this.http.post(this.url('imagen'),body));}
 catch(error){const e=error as {status?:number;error?:{message?:string}};
 if(e.status===0)throw new Error('No se recibió respuesta al enviar el archivo. Revisa si aparece en la lista antes de volver a cargarlo.');
 if(e.status===502||e.status===503||e.status===504)throw new Error('El servidor no pudo confirmar la carga (HTTP '+e.status+'). Revisa si el documento aparece antes de reintentar.');
 throw error;
 }
 this.notice.set('Documento agregado.');
 try{this.adjuntos.set(await this.get<Adjunto[]>(this.url('adjuntos')));}
 catch{this.error.set('El documento se guardó, pero no se pudo actualizar la lista. Vuelve a abrir la ficha; no necesitas subirlo otra vez.');}
 }
 private readonly base=`${Capacitor.isNativePlatform()?environment.androidApiUrl:environment.apiUrl}/ficha-medica/familiar`;private generation=0;private searchGeneration=0;private effectiveSearch='';private incidentRequest=crypto.randomUUID();
 readonly diseases=[{"code": "RESPIRATORIAS", "label": "Asma o problemas respiratorios / rinitis alérgica"}, {"code": "MIGRANA", "label": "Migraña o dolores de cabeza frecuentes"}, {"code": "DIABETES", "label": "Diabetes Mellitus"}, {"code": "CARDIOVASCULARES", "label": "Problemas cardiovasculares"}, {"code": "SINCOPE", "label": "Síncope (desmayo)"}, {"code": "CONVULSIONES", "label": "Convulsiones o epilepsia diagnosticada"}, {"code": "OTITIS", "label": "Infecciones recurrentes de oído"}, {"code": "DEPRESION", "label": "Depresión"}, {"code": "ANSIEDAD", "label": "Ansiedad"}, {"code": "TDAH", "label": "TDAH"}, {"code": "OTRA", "label": "Otra (especificar)"}];
 readonly sections=[
 {title:'Alergia y enfermedades',hint:'Información proporcionada por el familiar para referencia del Colegio.',block:'',keys:['alergias','anafilaxia','fechaAnafilaxia','padecimientos','otroPadecimiento','tratamientoActual','restriccionMedicamentos','medicamentosAutorizados','umbralDolor']},
 {title:'Peso y estatura informados por la familia',hint:'Datos de referencia; no sustituyen las mediciones del médico.',block:'',keys:['estaturaFamiliarCm','pesoFamiliarKg']},
 {title:'Actividades escolares',hint:'Limitaciones indicadas por un profesional, si las hay.',block:'',keys:['participaActividades','restriccionActividades']},
 {title:'Contactos de emergencia',hint:'Personas a quienes el Colegio puede llamar si es necesario.',block:'',keys:['contacto1Nombre','contacto1Parentesco','contacto1Telefono','contacto2Nombre','contacto2Parentesco','contacto2Telefono']},
 {title:'Médico, hospital y seguro',hint:'Datos de referencia para contactar o canalizar al alumno.',block:'',keys:['medico_familiar','telefono_medico','hospital_preferente','seguro_medico','poliza_seguro']},
 {title:'Cartilla de vacunación',hint:'Documento de referencia. Adjuntarlo no confirma que la vacunación esté completa.',block:'vacunacion',keys:[]},
 {title:'Receta o documento médico externo',hint:'Solo para conocimiento del Colegio. No acredita vigencia ni autoriza administrar medicamentos.',block:'tratamiento',keys:[]}
 ];
 sectionFields(keys:string[]){return keys.map(key=>this.fields.find(f=>f.key===key)!).filter(Boolean);}
 isPhone(key:string){return key.toLowerCase().includes('telefono');}
 isShortField(key:string){return this.isPhone(key)||key.startsWith('contacto')||['medico_familiar','hospital_preferente','seguro_medico','poliza_seguro'].includes(key);}
 private bloodGroup(f:Ficha){const value=f.grupoSanguineo??f.legacy?.['tipoSangreFicha']??f.legacy?.['tipoSangreCredencial'];const normalized=String(value??'').trim().toUpperCase().replace(/\s/g,'');return this.groups.includes(normalized)?normalized:f.declaracion?.fecha_declaracion?'NO_INFORMADO':'';}
 private normalizeFicha(f:Ficha|null):Ficha{if(!f)throw new Error('No fue posible cargar la ficha. Intenta nuevamente.');return {...f,referencia:f.referencia??{},adicionales:f.adicionales??{},bloques:f.bloques??{},legacy:f.legacy??{},autorizacion:f.autorizacion??{estado:'NO_ACREDITADA'}};}
 private normalizeIncidents(rows:Incidente[]|null):Incidente[]{return (Array.isArray(rows)?rows:[]).map(i=>({...i,aclaraciones:i.aclaraciones??[],contactos:i.contactos??[],autorizacion:i.autorizacion??{estado:'NO_ACREDITADA'}}));}

 readonly groups=['A+','A-','B+','B-','AB+','AB-','O+','O-'];
 readonly fields=[{"key": "umbralDolor", "label": "Umbral al dolor", "max": 5, "extra": true, "type": "pain", "block": ""}, {"key": "alergias", "label": "Alergias a alimentos o medicamentos", "max": 1000, "extra": false, "type": "text", "block": ""}, {"key": "medico_familiar", "label": "Médico externo de referencia", "max": 160, "extra": false, "type": "text", "block": ""}, {"key": "telefono_medico", "label": "Teléfono del médico", "max": 40, "extra": false, "type": "text", "block": ""}, {"key": "hospital_preferente", "label": "Hospital de preferencia", "max": 180, "extra": false, "type": "text", "block": ""}, {"key": "seguro_medico", "label": "Seguro médico (si cuenta con él)", "max": 160, "extra": false, "type": "text", "block": ""}, {"key": "poliza_seguro", "label": "Número de póliza", "max": 80, "extra": false, "type": "text", "block": ""}, {"key": "anafilaxia", "label": "¿Ha tenido una reacción alérgica grave (anafilaxia)?", "max": 1000, "extra": true, "type": "boolean", "block": ""}, {"key": "fechaAnafilaxia", "label": "Fecha del último evento de anafilaxia", "max": 1000, "extra": true, "type": "date", "block": ""}, {"key": "restriccionMedicamentos", "label": "Medicamentos que no debe recibir", "max": 1000, "extra": true, "type": "text", "block": ""}, {"key": "participaActividades", "label": "¿Puede participar en todas las actividades?", "max": 1000, "extra": true, "type": "boolean", "block": ""}, {"key": "restriccionActividades", "label": "Restricciones de actividades declaradas", "max": 1000, "extra": true, "type": "text", "block": ""}, {"key": "contacto1Nombre", "label": "Contacto de emergencia 1: Nombre", "max": 200, "extra": true, "type": "text", "block": ""}, {"key": "contacto1Parentesco", "label": "Contacto de emergencia 1: Parentesco", "max": 80, "extra": true, "type": "text", "block": ""}, {"key": "contacto1Telefono", "label": "Contacto de emergencia 1: Teléfono", "max": 40, "extra": true, "type": "text", "block": ""}, {"key": "contacto2Nombre", "label": "Contacto de emergencia 2: Nombre", "max": 200, "extra": true, "type": "text", "block": ""}, {"key": "contacto2Parentesco", "label": "Contacto de emergencia 2: Parentesco", "max": 80, "extra": true, "type": "text", "block": ""}, {"key": "contacto2Telefono", "label": "Contacto de emergencia 2: Teléfono", "max": 40, "extra": true, "type": "text", "block": ""}, {"key": "padecimientos", "label": "Padece algunas de las siguientes enfermedades:", "max": 1000, "extra": true, "type": "checklist", "block": ""}, {"key": "otroPadecimiento", "label": "Especifique otro", "max": 1000, "extra": true, "type": "text", "block": ""}, {"key": "tratamientoActual", "label": "En caso de presentar alguno de los padecimientos anteriores, favor de indicar si se encuentra en control y bajo tratamiento médico actual (incluya nombre del medicamento, dosis, horario y día de administración).", "max": 3000, "extra": true, "type": "text", "block": ""}, {"key": "medicamentosAutorizados", "label": "Especifica medicamentos autorizados:", "max": 1000, "extra": true, "type": "text", "block": ""}, {"key": "estaturaFamiliarCm", "label": "Estatura (centímetros)", "max": 6, "extra": true, "type": "number", "block": ""}, {"key": "pesoFamiliarKg", "label": "Peso (kilogramos)", "max": 6, "extra": true, "type": "number", "block": ""}];
 readonly legacyFields=[{key:'observacionesEnfermeria',label:'Observaciones registradas en la ficha anterior'},{key:'tipoSangreCredencial',label:'Tipo sanguíneo en credencial'},{key:'tipoSangreFicha',label:'Tipo sanguíneo en ficha anterior'},{key:'alergiasCredencial',label:'Alergias en credencial'},{key:'contactoEmergencia',label:'Contacto de emergencia anterior'},{key:'telefonoEmergencia',label:'Teléfono de emergencia anterior'}];
 readonly outcomes=[{key:'CLASES',label:'Regresa a clases'},{key:'SUPERVISION',label:'Permanece bajo supervisión'},{key:'ENTREGA_FAMILIAR',label:'Entrega al familiar autorizado'},{key:'CANALIZACION',label:'Canalización / traslado'}];
 readonly alumnos=signal<Alumno[]>([]);readonly selected=signal<Alumno|null>(null);readonly ficha=signal<Ficha|null>(null);readonly incidentes=signal<Incidente[]>([]);readonly adjuntos=signal<Adjunto[]>([]);
 readonly loading=signal(false);readonly busy=signal(false);readonly more=signal(false);readonly moreIncidents=signal(false);readonly error=signal('');readonly notice=signal('');readonly imageUrl=signal<string|null>(null);readonly editIncident=signal<number|null>(null);
 readonly searchForm=this.fb.nonNullable.group({buscar:['']});
 readonly form=this.fb.group(Object.fromEntries([{key:'grupoSanguineo',max:13},...this.fields].map(f=>[f.key,this.fb.control<string|null>('',this.fieldValidators(f.key,f.max))])));
 readonly incidentForm=this.fb.group({fechaIncidente:['',Validators.required],sintomas:['',[Validators.required,Validators.maxLength(3000)]],acciones:['',[Validators.required,Validators.maxLength(3000)]],resultado:['SUPERVISION',Validators.required],receptor:[''],destino:[''],fechaResultado:[''],pesoKg:[null as number|null],estaturaCm:[null as number|null],fechaMedicion:[''],motivoNoMedicion:['']});
 readonly authForm=this.fb.group({estado:['EXTERNA_DECLARADA'],referencia:['',Validators.required],representante:[''],fechaDocumento:[''],vigenteHasta:['']});
 readonly noteForm=this.fb.group({texto:['',Validators.required]});readonly contactForm=this.fb.group({persona:['',Validators.required],canal:['TELEFONO'],resultado:['SIN_RESPUESTA'],fecha:['',Validators.required]});
 goToIncident(){document.getElementById('registro-incidente')?.scrollIntoView({behavior:'smooth',block:'start'});}
 ngOnInit(){
for(const key of ['anafilaxia','participaActividades'])this.form.get(key)!.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(()=>this.syncDependentFields());
void this.loadParentescos();void this.search();
}
 ngOnDestroy(){this.documentInput?.remove();this.documentInput=null;this.generation++;this.searchGeneration++;this.closeImage();}
 private url(section:string){return `${this.base}/alumnos/${this.selected()!.idmatricula}/${section}`;}
 private async get<T>(url:string){const result=(await firstValueFrom(this.http.get<Envelope<T>>(url))).result;return (result??(/\/(alumnos|incidentes|adjuntos)(\?|$)/.test(url)?[]:null)) as T;}
 private async post(section:string,body:unknown,id?:number){return (await firstValueFrom(this.http.post<Envelope<unknown>>(this.url(section)+(id?`?id=${id}`:''),body))).result;}
 async search(){if(this.busy())return;this.effectiveSearch=this.searchForm.getRawValue().buscar.trim();this.alumnos.set([]);this.selected.set(null);this.ficha.set(null);this.generation++;this.closeImage();await this.list(0);}
 async loadMore(){await this.list(this.alumnos().length);}
 private async list(topi:number){const generation=++this.searchGeneration;this.loading.set(true);this.error.set('');const p=new URLSearchParams({topi:String(topi)});if(this.effectiveSearch)p.set('buscar',this.effectiveSearch);
 try{const rows=await this.get<Alumno[]>(`${this.base}/alumnos?${p.toString()}`);if(generation!==this.searchGeneration)return;this.alumnos.update(old=>topi?[...old,...rows]:rows);this.more.set(rows.length===15);}catch(e){if(generation===this.searchGeneration)this.fail(e);}finally{if(generation===this.searchGeneration)this.loading.set(false);}}
 async select(a:Alumno){if(this.busy())return;this.activeTab.set('info');this.validationAttempted.set(false);this.error.set('');this.selected.set(a);this.ficha.set(null);this.incidentes.set([]);this.adjuntos.set([]);this.closeImage();this.editIncident.set(null);this.incidentRequest=crypto.randomUUID();this.incidentForm.reset({resultado:'SUPERVISION'});this.notice.set('');await this.refresh();}
 private async refresh(){const generation=++this.generation;this.loading.set(true);try{const [rawFicha,rawItems,images]=await Promise.all([this.get<Ficha>(this.url('ficha')),this.get<Incidente[]>(this.url('incidentes')),this.get<Adjunto[]>(this.url('adjuntos'))]);if(generation!==this.generation)return;const f=this.normalizeFicha(rawFicha);const items=this.normalizeIncidents(rawItems);this.ficha.set(f);this.incidentes.set(items);this.moreIncidents.set(items.length===15);this.adjuntos.set(images??[]);const values:Record<string,string|null>={grupoSanguineo:this.bloodGroup(f)};for(const field of this.fields){const value=(field.extra?f.adicionales:f.referencia)[field.key];values[field.key]=value==null?'':String(value);}if(!f.declaracion?.fecha_declaracion){
values['contacto1Nombre'] ||= f.legacy['contactoEmergencia'] ?? '';
values['contacto1Telefono'] ||= f.legacy['telefonoEmergencia'] ?? '';
values['alergias'] ||= f.legacy['alergiasCredencial'] ?? '';
}this.form.reset(values);const diseases=f.adicionales['padecimientos'];this.selectedDiseases.set(Array.isArray(diseases)?diseases.filter(code=>this.diseases.some(d=>d.code===code)):[]);this.syncOtherDisease();if(this.family&&f.puedeEditar)this.form.enable();else this.form.disable();this.syncDependentFields();}catch(e){if(generation===this.generation)this.fail(e);}finally{if(generation===this.generation)this.loading.set(false);}}
 async loadIncidents(append=false){const generation=this.generation;try{const rows=await this.get<Incidente[]>(this.url('incidentes')+`?topi=${append?this.incidentes().length:0}`);if(generation!==this.generation)return;this.incidentes.update(old=>append?[...old,...rows]:rows);this.moreIncidents.set(rows.length===15);}catch(e){this.fail(e);}}
 async save(){if(!this.family||this.busy()||this.loading()||!this.ficha()?.puedeEditar)return;
 if(this.form.invalid){this.form.markAllAsTouched();this.validationAttempted.set(true);this.notice.set('');this.error.set('Completa las respuestas pendientes indicadas en el formulario antes de guardar.');setTimeout(()=>document.querySelector('.medica .invalid-field')?.scrollIntoView({behavior:'smooth',block:'center'}),0);const toast=await this.toastController.create({message:'Completa las respuestas pendientes indicadas en el formulario antes de guardar.',duration:4500,position:'bottom',color:'danger',buttons:[{text:'Cerrar',role:'cancel'}]});await toast.present();return;}
 this.validationAttempted.set(false);await this.run(async()=>{const raw=this.form.getRawValue();const referencia:Record<string,unknown>={};const adicionales:Record<string,unknown>={};for(const f of this.fields){if(f.type==='checklist')continue;const text=String(raw[f.key]??'').trim()||null;const value=f.type==='text'?text?.toUpperCase()??null:text;(f.extra?adicionales:referencia)[f.key]=f.type==='boolean'&&value?value==='true':f.type==='number'&&value?Number(value):value;}adicionales['padecimientos']=this.diseases.filter(d=>this.selectedDiseases().includes(d.code)).map(d=>d.code);if(!this.selectedDiseases().includes('OTRA'))adicionales['otroPadecimiento']=null;if(adicionales['anafilaxia']!==true)adicionales['fechaAnafilaxia']=null;
if(adicionales['participaActividades']!==false)adicionales['restriccionActividades']=null;
await this.post('guardar',{revision:this.ficha()!.revision,grupoSanguineo:raw['grupoSanguineo']==='NO_INFORMADO'?null:raw['grupoSanguineo']||null,referencia,adicionales});this.notice.set('La información de la ficha médica se guardó correctamente.');const toast=await this.toastController.create({message:'La información de la ficha médica se guardó correctamente.',duration:4500,position:'bottom',color:'success',buttons:[{text:'Cerrar',role:'cancel'}]});await toast.present();await this.refresh();});}
 private date(value:string|null|undefined){return value?new Date(value).toISOString():null;}
 async register(){if(this.incidentForm.invalid)return;await this.run(async()=>{const raw=this.incidentForm.getRawValue();await this.post('registrar',{...raw,solicitud:this.incidentRequest,fechaIncidente:this.date(raw.fechaIncidente),fechaResultado:this.date(raw.fechaResultado),fechaMedicion:this.date(raw.fechaMedicion)});this.incidentRequest=crypto.randomUUID();this.incidentForm.reset({resultado:'SUPERVISION'});await this.loadIncidents();this.notice.set('Incidente registrado. Revíselo antes de comunicarlo a la familia.');});}
 async communicate(i:Incidente){await this.run(async()=>{await this.post('comunicar',{},i.id);await this.loadIncidents();this.notice.set('Detalle disponible para la familia. Esto no confirma recepción del aviso ni contacto efectivo.');});}
 async clarify(i:Incidente){await this.run(async()=>{await this.post('aclarar',this.noteForm.getRawValue(),i.id);this.noteForm.reset();await this.loadIncidents();});}
 async contact(i:Incidente){await this.run(async()=>{const raw=this.contactForm.getRawValue();await this.post('contactar',{...raw,fecha:this.date(raw.fecha)},i.id);await this.loadIncidents();});}
 async saveAuthorization(){await this.run(async()=>{await this.post('autorizacion',Object.fromEntries(Object.entries(this.authForm.getRawValue()).map(([k,v])=>[k,v||null])));await this.refresh();this.notice.set('Referencia externa registrada; no modifica incidentes anteriores.');});}
 async upload(event:Event,tipo:string){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{await this.run(()=>this.uploadFile(file,tipo));}finally{input.value='';}}
 async openImage(a:Adjunto){
 if(this.busy())return;
 const previewTab=this.activeTab();
 const isPdf=a.contentType==='application/pdf'||a.nombre.toLowerCase().endsWith('.pdf');
 const native=Capacitor.isNativePlatform();
 const target=isPdf&&!native?window.open('about:blank','_blank'):null;
 if(isPdf&&!native&&!target){this.error.set('Permite abrir una pestaña para consultar el PDF.');return;}
 if(target)target.opener=null;
 await this.run(async()=>{try{
 const blob=await firstValueFrom(this.http.get(this.url(`imagenes/${a.id}`),{responseType:'blob'}));
 if(isPdf){if(native){
 const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('No fue posible leer el PDF.'));reader.readAsDataURL(blob);});
 const file=await Filesystem.writeFile({path:'medica-'+a.id+'.pdf',data,directory:Directory.Cache});
 await FileOpener.openFile({path:file.uri,mimeType:'application/pdf'});return;
 }
 const url=URL.createObjectURL(blob);if(target)target.location.href=url;setTimeout(()=>URL.revokeObjectURL(url),60000);
 }else if(this.activeTab()===previewTab){this.closeImage();this.imageUrl.set(URL.createObjectURL(blob));}
 }catch(e){target?.close();throw e;}});
 }
 closeImage(){const url=this.imageUrl();if(url)URL.revokeObjectURL(url);this.imageUrl.set(null);}
 async retire(a:Adjunto){await this.run(async()=>{await this.post('retirar',{},a.id);this.closeImage();this.adjuntos.set(await this.get<Adjunto[]>(this.url('adjuntos')));});}
 authorizationLabel(state:string){return ({NO_ACREDITADA:'AUTORIZACIÓN NO ACREDITADA EN SECLIFE',EXTERNA_DECLARADA:'AUTORIZACIÓN EXTERNA DECLARADA POR EL COLEGIO',REGISTRADA_SECLIFE:'AUTORIZACIÓN REGISTRADA EN SECLIFE',RECHAZADA:'AUTORIZACIÓN RECHAZADA',REVOCADA:'AUTORIZACIÓN REVOCADA',VENCIDA:'AUTORIZACIÓN VENCIDA'} as Record<string,string>)[state]??'AUTORIZACIÓN NO ACREDITADA EN SECLIFE';}
 outcome(key:string){return this.outcomes.find(o=>o.key===key)?.label??key;}
 private async run(action:()=>Promise<void>){if(this.busy())return;this.busy.set(true);this.error.set('');this.notice.set('');try{await action();}catch(e){this.fail(e);}finally{this.busy.set(false);}}
 private fail(error:unknown){const e=error as {error?:{message?:string};message?:string};this.error.set(e.error?.message??e.message??'No fue posible completar la operación.');}
}
