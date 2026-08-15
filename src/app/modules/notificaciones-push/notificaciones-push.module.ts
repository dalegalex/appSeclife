import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { NotificacionesPushRoutingModule } from './notificaciones-push-routing.module';
import { HistorialNotificacionesPage } from './pages/historial-notificaciones/historial-notificaciones.page';
import { PreferenciasNotificacionesPage } from './pages/preferencias-notificaciones/preferencias-notificaciones.page';

@NgModule({
  imports: [CommonModule, IonicModule, NotificacionesPushRoutingModule],
  declarations: [HistorialNotificacionesPage, PreferenciasNotificacionesPage],
})
export class NotificacionesPushModule {}