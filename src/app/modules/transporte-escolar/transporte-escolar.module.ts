import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TransporteEscolarRoutingModule } from './transporte-escolar-routing.module';
import { ConductorDashboardPage } from './pages/conductor-dashboard/conductor-dashboard.page';
import { PadreDashboardPage } from './pages/padre-dashboard/padre-dashboard.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TransporteEscolarRoutingModule,
  ],
  declarations: [ConductorDashboardPage, PadreDashboardPage],
})
export class TransporteEscolarModule {}
