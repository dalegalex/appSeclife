import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthProfileGuard } from '../../core/auth/auth.guard';
import { MisAlumnosFichaPage } from './pages/mis-alumnos/mis-alumnos.page';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'mis-alumnos',
    pathMatch: 'full',
  },
  {
    path: 'mis-alumnos',
    canActivate: [AuthProfileGuard],
    data: { profiles: [4] },
    component: MisAlumnosFichaPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FichaAlumnoRoutingModule {}
