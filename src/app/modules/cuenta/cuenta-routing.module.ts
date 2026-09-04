import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EliminacionCuentaPage } from './pages/eliminacion-cuenta/eliminacion-cuenta.page';
import { SeguridadPage } from './pages/seguridad/seguridad.page';

const routes: Routes = [
  {
    path: 'eliminacion',
    component: EliminacionCuentaPage,
  },
  {
    path: 'seguridad',
    component: SeguridadPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CuentaRoutingModule {}
