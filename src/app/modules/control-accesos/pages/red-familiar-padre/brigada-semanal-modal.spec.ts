import { of, Subject, throwError } from 'rxjs';
import { BrigadaSemanalModalComponent } from './brigada-semanal-modal.component';
import { BrigadaSemanalConsulta } from '../../models/brigada-semanal.model';

describe('Consulta informativa de brigadas', () => {
  let component: BrigadaSemanalModalComponent;
  let api: any;
  const data = (): BrigadaSemanalConsulta => ({visible:true,idciclo:202627,permisosEfectivos:false,
    brigadas:[{idfila:1,idfamilia:200,familia:'Destino A',dias:5,estado:'EN_REVISION',familiares:[]},
      {idfila:2,idfamilia:300,familia:'Destino B',dias:2,estado:'APROBADA_PENDIENTE_ACTIVACION',familiares:[]}]});
  beforeEach(() => {
    api={consultarBrigadasSemanales:jasmine.createSpy().and.returnValue(of(data()))};
    component=new BrigadaSemanalModalComponent(api,{dismiss:async()=>true} as any);
    component.idfamilia=100;component.idmatricula=10;
  });
  afterEach(()=>component.ngOnDestroy());
  it('loads on demand and filters Monday, Tuesday and Wednesday correctly',()=>{
    expect(api.consultarBrigadasSemanales).not.toHaveBeenCalled();component.ngOnInit();
    expect(api.consultarBrigadasSemanales).toHaveBeenCalledWith(100,10);
    expect(component.filasDelDia()[0].idfamilia).toBe(200);
    component.seleccionarDia('1');expect(component.filasDelDia()[0].idfamilia).toBe(300);
    component.seleccionarDia(2);expect(component.filasDelDia()[0].idfamilia).toBe(200);
    component.seleccionarDia(6);expect(component.filasDelDia()).toEqual([]);
  });
  it('never labels approval as effective authorization',()=>{
    component.ngOnInit();expect(component.estado(data().brigadas[1])).toBe('Aprobada, pendiente de activacion');
    expect(component.estado({...data().brigadas[0],estado:'ACTIVA'})).toBe('En revision');
  });
  it('initializes only once when Ionic enters before Angular initialization',()=>{
    component.ionViewWillEnter();component.ngOnInit();component.ionViewWillEnter();
    expect(api.consultarBrigadasSemanales).toHaveBeenCalledTimes(1);
  });
  it('clears previous personal information on error and supports retry',()=>{
    component.ngOnInit();api.consultarBrigadasSemanales.and.returnValue(throwError(()=>new Error('403')));
    component.cargar();expect(component.datos()).toBeNull();expect(component.error()).not.toBe('');
    api.consultarBrigadasSemanales.and.returnValue(of(data()));component.cargar();expect(component.error()).toBe('');
  });
  it('does not render disabled data and cancels queries on close',()=>{
    component.datos.set({...data(),visible:false});expect(component.filasDelDia()).toEqual([]);
    const response=new Subject<BrigadaSemanalConsulta>();api.consultarBrigadasSemanales.and.returnValue(response);
    component.cargar();component.ngOnDestroy();response.next(data());expect(component.datos()).toBeNull();
  });
});
