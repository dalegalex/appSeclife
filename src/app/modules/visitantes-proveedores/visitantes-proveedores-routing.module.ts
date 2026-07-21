import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RegistroVisitanteProveedorPage } from '../control-accesos/pages/registro-visitante-proveedor/registro-visitante-proveedor.page';

const routes: Routes = [
  {
    path: 'registro/:codigo',
    component: RegistroVisitanteProveedorPage,
  },
  {
    path: '',
    redirectTo: 'registro',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VisitantesProveedoresRoutingModule {}
