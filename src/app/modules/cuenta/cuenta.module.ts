import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CuentaRoutingModule } from './cuenta-routing.module';
import { EliminacionCuentaPage } from './pages/eliminacion-cuenta/eliminacion-cuenta.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    CuentaRoutingModule,
  ],
  declarations: [EliminacionCuentaPage],
})
export class CuentaModule {}
