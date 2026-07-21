import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RegistroVisitanteProveedorPage } from '../control-accesos/pages/registro-visitante-proveedor/registro-visitante-proveedor.page';
import { VisitantesProveedoresRoutingModule } from './visitantes-proveedores-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    VisitantesProveedoresRoutingModule,
  ],
  declarations: [
    RegistroVisitanteProveedorPage,
  ],
})
export class VisitantesProveedoresModule {}
