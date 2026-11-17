import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { AbordajeService, AbordajeEstado, AbordajeAlumno, AbordajePase, AbordajeRuta } from '../../services/abordaje.service';

@Component({
 selector: 'app-pase-abordaje', standalone: true, imports: [CommonModule, IonicModule],
 templateUrl: './pase-abordaje.component.html', styleUrl: './pase-abordaje.component.scss'
})
export class PaseAbordajeComponent implements OnInit, OnDestroy {
 private readonly api = inject(AbordajeService);
 private readonly alert = inject(AlertController);
 private readonly auth = inject(AuthService);
 private readonly borradores = new Map<string, Record<string, boolean>>();
 readonly rutas = signal<AbordajeRuta[]>([]);
 readonly idruta = signal<number | null>(null);
 readonly estado = signal<AbordajeEstado | null>(null);
 readonly busy = signal(false);
 readonly loading = signal(true);
 readonly error = signal('');
 readonly mensaje = signal('');
 readonly ruta = computed(() => this.rutas().find(r => r.idruta === this.idruta()));
 readonly abierto = computed(() => this.estado()?.pase?.estado === 'ABIERTO');
 readonly alumnos = computed(() => this.estado()?.alumnos ?? []);
 readonly disponibles = computed(() => this.alumnos().filter(a => !a.idevento && !a.motivoBloqueo && !a.salidaRegistrada));
 readonly excluidos = computed(() => this.alumnos().filter(a => !a.idevento && (!!a.motivoBloqueo || !!a.salidaRegistrada)));
 readonly registrados = computed(() => this.alumnos().filter(a => !!a.idevento));
 readonly seleccionados = computed(() => this.alumnos().filter(a => a.seleccionado).length);
 readonly solicitados = computed(() => this.alumnos().filter(a => !!a.idevento).length);
 readonly porEnviar = computed(() => this.alumnos().filter(a => a.seleccionado && !a.idevento).length);
 readonly fallidos = computed(() => this.alumnos().some(a => a.avisos.fallidos > 0));
 readonly reintentables = computed(() => this.alumnos().reduce((total,a) => total + (a.avisos.reintentables ?? 0),0));
 private timer?: ReturnType<typeof setInterval>;
 private destroyed = false;
 private consulta = 0;

 async ngOnInit() {
   clearInterval(this.timer);
   this.loading.set(true);
   try {
     this.rutas.set((await firstValueFrom(this.api.rutas())).result);
     const anterior = this.idruta();
     const id = this.rutas().some(r => r.idruta === anterior) ? anterior
       : this.rutas().length === 1 ? this.rutas()[0].idruta : null;
     this.idruta.set(id);
     this.estado.set(null);
     if (id) await this.recargar(false);
     this.timer = setInterval(() => { if (!this.busy()) void this.recargar(false); }, 15000);
   } catch (e) { this.error.set(this.errorText(e)); }
   finally { this.loading.set(false); }
 }
 ngOnDestroy() { this.destroyed = true; clearInterval(this.timer); }
 async elegirRuta(id: number) {
   const nueva = Number(id);
   if (this.busy() || !this.rutas().some(r => r.idruta === nueva)) return;
   this.idruta.set(nueva); this.estado.set(null); this.error.set(''); this.mensaje.set('');
   await this.recargar();
 }
 async recargar(show = true) {
   const id = this.idruta(); if (this.busy()) return;
   if (!id) { if (show) await this.ngOnInit(); return; }
   const consulta = ++this.consulta;
   if (show) this.loading.set(true);
   try {
     const response = await firstValueFrom(this.api.consultar(id));
     if (!this.destroyed && !this.busy() && consulta === this.consulta && id === this.idruta()) { this.aplicarEstado(response.result); this.error.set(''); }
   } catch(e) { if (!this.destroyed && consulta === this.consulta && id === this.idruta()) this.error.set(this.errorText(e)); }
   finally { if(consulta === this.consulta) this.loading.set(false); }
 }
 async iniciar() {
   const id=this.idruta(); if(!id || this.busy()) return;
   this.busy.set(true); this.error.set(''); this.mensaje.set('');
   try { this.aplicarEstado((await firstValueFrom(this.api.iniciar(id))).result); }
   catch(e) { this.error.set(this.errorText(e)); }
   finally { this.busy.set(false); }
 }
 async marcar(alumno: AbordajeAlumno, seleccionado: boolean) {
   if(!this.abierto() || alumno.idevento || alumno.salidaRegistrada || alumno.motivoBloqueo || this.busy()) return;
   this.estado.update(s => s ? {...s, alumnos: s.alumnos.map(a => a.idrecorridoalumno === alumno.idrecorridoalumno ? {...a, seleccionado} : a)} : s);
   this.guardarBorrador();
 }
 cambiarSeleccion(alumno: AbordajeAlumno, event: CustomEvent<{ checked: boolean }>) {
   const checked = event.detail.checked;
   void this.marcar(alumno, checked);
 }
 async enviar() {
   if(!this.porEnviar() || !this.abierto() || this.busy()) return;
   const s=this.estado()!;
   if(s.seleccionLocalVersion !== 2 || !s.versionEvaluacion) { this.error.set('Actualiza el servicio de abordaje antes de registrar salidas.'); return; }
   const seleccion=this.disponibles().filter(a => a.seleccionado);
   const sinEntrada=seleccion.filter(a => a.sinEntrada).length;
   const contradicciones=seleccion.filter(a => !a.sinEntrada && !!a.advertencia).length;
   const body={revision:s.pase!.revision,versionEvaluacion:s.versionEvaluacion,alumnosSeleccionados:seleccion.map(a => a.idrecorridoalumno)};
   if(await this.confirmar('Registrar SALIDA', 'Confirma la presencia de los ' + seleccion.length + ' alumnos seleccionados. ' +
     sinEntrada + ' sin entrada registrada hoy. ' + contradicciones + ' con entrada y ausencia vigente. Se registraran sus salidas y se solicitaran los avisos.'))
     await this.ejecutar('registrar-salidas', body, 'Salida registrada. Los avisos se procesan en segundo plano.');
 }
 async cerrar() {
   if(this.porEnviar() || !this.abierto() || this.busy()) return;
   const revision=this.estado()!.pase!.revision;
   const versionEvaluacion=this.estado()!.versionEvaluacion;
   if(this.estado()!.seleccionLocalVersion!==2 || !versionEvaluacion) { this.error.set('Actualiza el servicio de abordaje antes de cerrar.'); return; }
   if(await this.confirmar('Cerrar abordaje', this.solicitados() + ' alumnos con aviso solicitado. Los demas quedaran sin registro de abordaje.'))
     await this.ejecutar('cerrar-local', { revision,versionEvaluacion,alumnosSeleccionados:[] }, 'Abordaje cerrado.');
 }
 async reintentar() {
   if(!this.reintentables() || this.busy()) return;
   await this.ejecutar('reintentar', {}, 'Reintento solicitado solo para errores temporales disponibles.');
 }
 async corregir(alumno: AbordajeAlumno) {
   if(this.busy()) return;
   const motivo=await this.pedirMotivo('Registrar correccion', 'El aviso anterior no puede retirarse. La aclaracion quedara en el historial.');
   if(motivo) await this.ejecutar('correccion', { idrecorridoalumno: alumno.idrecorridoalumno, motivo });
 }
 async cerrarPendiente(pase: AbordajePase) {
   if(this.busy()) return;
   const motivo=await this.pedirMotivo('Cerrar pase pendiente', 'Escribe el motivo. No se enviaran avisos ni se completaran marcas anteriores.');
   if(motivo) { await this.ejecutar('cerrar-pendiente', { motivo, revision:pase.revision }, 'Cierre incompleto registrado.', pase.idrecorrido); await this.recargar(); }
 }
 private async ejecutar(accion: string, body: object, mensaje='', id=this.estado()?.pase?.idrecorrido) {
   if(!id || this.busy()) return;
   this.busy.set(true); this.error.set(''); this.mensaje.set('');
   try {
     const result=await firstValueFrom(this.api.accion(id,accion,{revision:this.estado()?.pase?.revision,...body}));
     if(!this.destroyed) { this.aplicarEstado(result.result); this.mensaje.set(mensaje); }
   } catch(e) {
     const error=this.errorText(e);
     this.busy.set(false); await this.recargar(false); this.error.set(error);
   } finally { this.busy.set(false); }
 }
 private async confirmar(header: string, message: string) {
   this.busy.set(true);
   try {
     const dialog=await this.alert.create({header,message,buttons:[{text:'Cancelar',role:'cancel'},{text:'Confirmar',role:'confirm'}]});
     await dialog.present(); return (await dialog.onDidDismiss()).role==='confirm';
   } finally { this.busy.set(false); }
 }
 private async pedirMotivo(header: string, message: string) {
   this.busy.set(true);
   try {
     const dialog=await this.alert.create({header,message,inputs:[{name:'motivo',type:'textarea',placeholder:'Motivo',attributes:{maxlength:500}}],
       buttons:[{text:'Cancelar',role:'cancel'},{text:'Guardar',role:'confirm',handler: data => !!data.motivo?.trim()}]});
     await dialog.present(); const result=await dialog.onDidDismiss();
     return result.role==='confirm' ? String(result.data?.values?.motivo ?? '').trim() : '';
   } finally { this.busy.set(false); }
 }
 estadoAviso(a: AbordajeAlumno) {
   if(a.motivoBloqueo && !a.idevento) return a.motivoBloqueo;
   if(a.salidaRegistrada && !a.idevento) return 'Salida registrada';
   if(!a.idevento) return this.abierto() ? (a.seleccionado ? 'Seleccionado' : '') : (a.seleccionado ? 'Seleccion sin enviar' : 'Sin registro de abordaje');
   if(a.avisos.fallidos) return 'Avisos con error: ' + a.avisos.fallidos;
   if(a.avisos.pendientes) return 'Avisos en cola o en proceso: ' + a.avisos.pendientes;
   if(a.avisos.total && a.avisos.omitidos===a.avisos.total) return 'Avisos omitidos: sin dispositivo habilitado';
   if(a.avisos.enviados) return 'Avisos aceptados por el proveedor: ' + a.avisos.enviados +
     (a.avisos.omitidos ? '. Omitidos: ' + a.avisos.omitidos : '');
   if(!a.avisos.total && a.procesado) return 'Sin destinatarios habilitados';
   return 'Aviso solicitado';
 }
 private claveBorrador(s: AbordajeEstado): string | null {
   const actor=this.auth.getCurrentUserId(),org=this.auth.getCurrentUser()?.idorg;
   return actor && org && s.pase ? 'abordaje.local.v1:' + org + ':' + actor + ':' + s.idruta + ':' + s.pase.idrecorrido + ':' + s.pase.fecha : null;
 }
 private aplicarEstado(s: AbordajeEstado) {
   const key=this.claveBorrador(s);
   let draft=key ? this.borradores.get(key) : undefined;
   if(key && !draft) {
     try {
       const saved=JSON.parse(localStorage.getItem(key) || 'null');
       if(saved && saved.fecha===s.fechaServidor && saved.seleccion && typeof saved.seleccion==='object') draft=saved.seleccion;
     } catch { /* El borrador corrupto no debe impedir consultar el pase. */ }
   }
   const previo=this.estado();
   if(draft && previo && previo.pase?.idrecorrido===s.pase?.idrecorrido &&
     (previo.versionEvaluacion!==s.versionEvaluacion || previo.pase?.revision!==s.pase?.revision)) {
     this.mensaje.set('La asistencia o el pase cambio. Revisa el total y los motivos antes de confirmar.');
   }
   const open=s.pase?.estado==='ABIERTO' && s.pase.fecha===s.fechaServidor;
   this.estado.set({...s, alumnos:s.alumnos.map(a => ({...a, seleccionado: a.idevento ? true :
     !open || a.motivoBloqueo || a.salidaRegistrada ? false :
     draft ? draft[String(a.idrecorridoalumno)] === true :
     s.seleccionLocalVersion===2 && s.preseleccionar ? true : a.seleccionado}))});
   this.guardarBorrador();
 }
 private guardarBorrador() {
   const s=this.estado(); if(!s) return;
   const key=this.claveBorrador(s); if(!key) return;
   if(s.pase?.estado!=='ABIERTO' || s.pase.fecha!==s.fechaServidor) {
     this.borradores.delete(key);
     try { localStorage.removeItem(key); } catch {}
     return;
   }
   const seleccion=Object.fromEntries(s.alumnos.filter(a => !a.idevento).map(a => [String(a.idrecorridoalumno),a.seleccionado]));
   this.borradores.set(key,seleccion);
   try { localStorage.setItem(key,JSON.stringify({fecha:s.fechaServidor,seleccion})); }
   catch { this.mensaje.set('Seleccion conservada en esta pantalla; no fue posible guardar el borrador en el dispositivo.'); }
 }
 private errorText(e: any) { return e?.error?.message ?? e?.message ?? 'No fue posible confirmar la operacion. Actualiza el pase.'; }
}
