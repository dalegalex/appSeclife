import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EliminacionCuentaPage } from './pages/eliminacion-cuenta/eliminacion-cuenta.page';

const routes: Routes = [
  {
    path: 'eliminacion',
    component: EliminacionCuentaPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CuentaRoutingModule {}
