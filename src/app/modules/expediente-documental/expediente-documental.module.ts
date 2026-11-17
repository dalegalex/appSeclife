import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ExpedienteDocumentalRoutingModule } from './expediente-documental-routing.module';
import { ExpedienteDocumentalPage } from './pages/expediente-documental/expediente-documental.page';
import { ExpedientePreparacionComponent } from './components/expediente-preparacion.component';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, ExpedienteDocumentalRoutingModule, ExpedientePreparacionComponent],
  declarations: [ExpedienteDocumentalPage],
})
export class ExpedienteDocumentalModule {}
