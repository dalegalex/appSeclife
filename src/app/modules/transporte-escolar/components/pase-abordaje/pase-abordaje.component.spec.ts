import { TestBed } from '@angular/core/testing';
import { AlertController } from '@ionic/angular';
import { of, Subject, throwError } from 'rxjs';
import { PaseAbordajeComponent } from './pase-abordaje.component';
import { AbordajeService, AbordajeEstado } from '../../services/abordaje.service';

describe('PaseAbordajeComponent', () => {
 let component: PaseAbordajeComponent;
 let api: jasmine.SpyObj<AbordajeService>;
 let response: AbordajeEstado;
 let confirmation: string;
 beforeEach(() => {
  response={idruta:2,fechaServidor:'2026-09-10',pase:{idrecorrido:20,fecha:'2026-09-10',estado:'ABIERTO',revision:3},
   alumnos:[{idrecorridoalumno:10,nombre:'ALUMNO',seleccionado:true,procesado:false,avisos:{total:0,enviados:0,fallidos:0}}],pendientes:[]};
  api=jasmine.createSpyObj('AbordajeService',['consultar','iniciar','accion','rutas']);
  api.rutas.and.returnValue(of({codeNumber:200,message:'',result:[{idruta:1,sentido:'SALIDA',descripcion:'R1',unidad:'U',conductor:'C'},{idruta:2,sentido:'SALIDA',descripcion:'R2',unidad:'U',conductor:'C'}]}));
  api.consultar.and.returnValue(of({result:response,codeNumber:200,message:''}));
  api.accion.and.returnValue(of({result:response,codeNumber:200,message:''}));
  confirmation='confirm';
  TestBed.configureTestingModule({providers:[
   {provide:AbordajeService,useValue:api},
   {provide:AlertController,useValue:{create:async()=>({present:async()=>{},onDidDismiss:async()=>({role:confirmation})})}}
  ]});
  component=TestBed.runInInjectionContext(()=>new PaseAbordajeComponent());
  component.idruta.set(2); component.estado.set(response);
 });
 afterEach(()=>component.ngOnDestroy());
 it('marcar solo persiste seleccion, nunca envia aviso',async()=>{
  await component.marcar(response.alumnos[0],false);
  expect(api.accion).toHaveBeenCalledOnceWith(20,'seleccion',{revision:3,idrecorridoalumno:10,seleccionado:false});
 });
 it('requiere confirmar el total y protege la revision',async()=>{
  confirmation='cancel'; await component.enviar(); expect(api.accion).not.toHaveBeenCalled();
  confirmation='confirm'; await component.enviar();
  expect(api.accion).toHaveBeenCalledOnceWith(20,'enviar',{revision:3});
 });
 it('impide cerrar mientras hay seleccion sin enviar',async()=>{
  await component.cerrar(); expect(api.accion).not.toHaveBeenCalled();
 });
 it('no permite desmarcar un aviso solicitado',async()=>{
  response.alumnos[0].idevento=7;
  await component.marcar(response.alumnos[0],false);
  expect(api.accion).not.toHaveBeenCalled();
 });
 it('bloquea ultimo acceso SALIDA y muestra motivo sin ocultar al alumno',async()=>{
  response.alumnos[0].salidaRegistrada=true;
  await component.marcar(response.alumnos[0],true);
  expect(api.accion).not.toHaveBeenCalled();
  expect(component.alumnos().length).toBe(1);
  expect(component.estadoAviso(response.alumnos[0])).toBe('Salida registrada');
 });
 it('permite seleccionar tras una ENTRADA posterior',async()=>{
  response.alumnos[0].salidaRegistrada=false;
  await component.marcar(response.alumnos[0],true);
  expect(api.accion).toHaveBeenCalledOnceWith(20,'seleccion',{revision:3,idrecorridoalumno:10,seleccionado:true});
 });
 it('reconcilia respuesta incierta sin reenviar automaticamente',async()=>{
  api.accion.and.returnValue(throwError(()=>({error:{message:'Conexion interrumpida'}})));
  await component.marcar(response.alumnos[0],false);
  expect(api.consultar).toHaveBeenCalledOnceWith(2);
  expect(api.accion).toHaveBeenCalledTimes(1);
  expect(component.error()).toBe('Conexion interrumpida');
 });
 it('no aplica una consulta antigua mientras se confirma una accion',async()=>{
  const pending=new Subject<any>();api.consultar.and.returnValue(pending);
  const task=component.recargar(false);component.busy.set(true);
  pending.next({result:{...response,pase:undefined},codeNumber:200});pending.complete();await task;
  expect(component.estado()?.pase?.idrecorrido).toBe(20);
 });
 it('no impone un pase abierto de otra ruta al ingresar',async()=>{
  api.consultar.and.callFake((id:number)=>of({codeNumber:200,message:'',result:id===2?response:{...response,idruta:1,pase:undefined}}));
  component.idruta.set(null);
  await component.ngOnInit();
  expect(component.idruta()).toBeNull();
  expect(component.estado()).toBeNull();
  expect(api.consultar).not.toHaveBeenCalled();
 });
 it('permite cambiar de ruta con pase abierto sin cerrarlo ni enviar avisos',async()=>{
  component.rutas.set([{idruta:1,descripcion:'R1',sentido:'SALIDA',unidad:'U',conductor:'C'}]);
  api.consultar.and.returnValue(of({codeNumber:200,message:'',result:{...response,idruta:1,pase:undefined,alumnos:[]}}));
  await component.elegirRuta(1);
  expect(component.idruta()).toBe(1);
  expect(component.estado()?.pase).toBeUndefined();
  expect(api.accion).not.toHaveBeenCalled();
 });
 it('rechaza respuestas antiguas al cambiar de ruta y volver',async()=>{
  component.rutas.set([{idruta:1,descripcion:'R1',sentido:'SALIDA',unidad:'U',conductor:'C'},{idruta:2,descripcion:'R2',sentido:'SALIDA',unidad:'U',conductor:'C'}]);
  const anterior=new Subject<any>();
  api.consultar.and.returnValues(anterior,of({result:{...response,idruta:1,pase:undefined,alumnos:[]},codeNumber:200,message:''}),of({result:{...response,pase:{...response.pase!,revision:9}},codeNumber:200,message:''}));
  const tarea=component.recargar(false);
  await component.elegirRuta(1);
  await component.elegirRuta(2);
  anterior.next({result:response,codeNumber:200,message:''});anterior.complete();await tarea;
  expect(component.estado()?.pase?.revision).toBe(9);
 });
});
