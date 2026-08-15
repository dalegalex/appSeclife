import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ControlAccesosRoutingModule } from './control-accesos-routing.module';
import { LecturaAsistidaPage } from './pages/lectura-asistida/lectura-asistida.page';
import { CarruselEntregaPage } from './pages/carrusel-entrega/carrusel-entrega.page';
import { CarruselVisorPage } from './pages/carrusel-visor/carrusel-visor.page';
import { RedFamiliarPadrePage } from './pages/red-familiar-padre/red-familiar-padre.page';
import { BitacoraAccesoPadrePage } from './pages/bitacora-acceso-padre/bitacora-acceso-padre.page';
import { AvisosAsistenciaPadrePage } from './pages/avisos-asistencia-padre/avisos-asistencia-padre.page';
import { CredencialDigitalPage } from './pages/credencial-digital/credencial-digital.page';
import { LecturaAutogestionadaPage } from './pages/lectura-autogestionada/lectura-autogestionada.page';
import { VisitantesProveedoresGuardiaPage } from './pages/visitantes-proveedores-guardia/visitantes-proveedores-guardia.page';
import { EventosFamiliaresPage } from './pages/eventos-familiares/eventos-familiares.page';
import { EventosSocialesFamiliaresPage } from './pages/eventos-sociales-familiares/eventos-sociales-familiares.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ControlAccesosRoutingModule,
  ],
  declarations: [
    LecturaAsistidaPage,
    CarruselEntregaPage,
    CarruselVisorPage,
    RedFamiliarPadrePage,
    BitacoraAccesoPadrePage,
    AvisosAsistenciaPadrePage,
    CredencialDigitalPage,
    LecturaAutogestionadaPage,
    VisitantesProveedoresGuardiaPage,
    EventosFamiliaresPage,
    EventosSocialesFamiliaresPage,
  ],
})
export class ControlAccesosModule {}
