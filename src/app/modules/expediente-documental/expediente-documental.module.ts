import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ExpedienteDocumentalRoutingModule } from './expediente-documental-routing.module';
import { ExpedienteDocumentalPage } from './pages/expediente-documental/expediente-documental.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, ExpedienteDocumentalRoutingModule],
  declarations: [ExpedienteDocumentalPage],
})
export class ExpedienteDocumentalModule {}
