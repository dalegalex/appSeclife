import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { FichaAlumnoRoutingModule } from './ficha-alumno-routing.module';
import { MisAlumnosFichaPage } from './pages/mis-alumnos/mis-alumnos.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    FichaAlumnoRoutingModule,
  ],
  declarations: [
    MisAlumnosFichaPage,
  ],
})
export class FichaAlumnoModule {}
