import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthProfileGuard } from '../../core/auth/auth.guard';
import { ExpedienteDocumentalPage } from './pages/expediente-documental/expediente-documental.page';

const routes: Routes = [
  {
    path: '',
    canActivate: [AuthProfileGuard],
    data: { profiles: [4] },
    component: ExpedienteDocumentalPage,
  },
];

@NgModule({ imports: [RouterModule.forChild(routes)], exports: [RouterModule] })
export class ExpedienteDocumentalRoutingModule {}
