import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HistorialNotificacionesPage } from './pages/historial-notificaciones/historial-notificaciones.page';
import { PreferenciasNotificacionesPage } from './pages/preferencias-notificaciones/preferencias-notificaciones.page';

const routes: Routes = [
  {
    path: 'historial',
    component: HistorialNotificacionesPage,
  },
  {
    path: 'preferencias',
    component: PreferenciasNotificacionesPage,
  },
  {
    path: '',
    redirectTo: 'historial',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NotificacionesPushRoutingModule {}