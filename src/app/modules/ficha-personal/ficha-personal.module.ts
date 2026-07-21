import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { FichaPersonalRoutingModule } from './ficha-personal-routing.module';
import { MiFichaPage } from './pages/mi-ficha/mi-ficha.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    FichaPersonalRoutingModule,
  ],
  declarations: [
    MiFichaPage,
  ],
})
export class FichaPersonalModule {}
