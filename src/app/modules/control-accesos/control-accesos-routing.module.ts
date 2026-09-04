import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthProfileGuard } from '../../core/auth/auth.guard';
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
import { EnrolamientoCredencialesPage } from './pages/enrolamiento-credenciales/enrolamiento-credenciales.page';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'lectura-asistida',
    pathMatch: 'full',
  },
  {
    path: 'enrolamiento',
    canActivate: [AuthProfileGuard],
    data: { profiles: [1, 2, 3] },
    component: EnrolamientoCredencialesPage,
  },
  {
    path: 'lectura-asistida',
    canActivate: [AuthProfileGuard],
    data: { profiles: [1, 2, 3] },
    component: LecturaAsistidaPage,
  },
  {
    path: 'lectura-autogestionada',
    canActivate: [AuthProfileGuard],
    data: { profiles: [1, 2, 3] },
    component: LecturaAutogestionadaPage,
  },
  {
    path: 'red-familiar',
    canActivate: [AuthProfileGuard],
    data: { profiles: [4] },
    component: RedFamiliarPadrePage,
  },
  {
    path: 'red-familiar/eventos',
    canActivate: [AuthProfileGuard],
    data: { profiles: [4] },
    component: EventosSocialesFamiliaresPage,
  },
  {
    path: 'bitacora',
    canActivate: [AuthProfileGuard],
    data: { profiles: [4] },
    component: BitacoraAccesoPadrePage,
  },
  {
    path: 'avisos-asistencia',
    canActivate: [AuthProfileGuard],
    data: { profiles: [4] },
    component: AvisosAsistenciaPadrePage,
  },
  {
    path: 'eventos',
    canActivate: [AuthProfileGuard],
    data: { profiles: [4] },
    component: EventosFamiliaresPage,
  },
  {
    path: 'credencial-digital',
    canActivate: [AuthProfileGuard],
    component: CredencialDigitalPage,
  },
  {
    path: 'carrusel',
    canActivate: [AuthProfileGuard],
    data: { profiles: [1, 2, 3] },
    component: CarruselEntregaPage,
  },
  {
    path: 'carrusel-visor',
    canActivate: [AuthProfileGuard],
    data: { profiles: [1, 2, 3] },
    component: CarruselVisorPage,
  },
  {
    path: 'visitantes-proveedores',
    canActivate: [AuthProfileGuard],
    data: { profiles: [1, 2, 3] },
    component: VisitantesProveedoresGuardiaPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ControlAccesosRoutingModule {}
