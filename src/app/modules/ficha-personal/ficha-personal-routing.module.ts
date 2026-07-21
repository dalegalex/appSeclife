import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthProfileGuard } from '../../core/auth/auth.guard';
import { MiFichaPage } from './pages/mi-ficha/mi-ficha.page';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'mi-ficha',
    pathMatch: 'full',
  },
  {
    path: 'mi-ficha',
    canActivate: [AuthProfileGuard],
    data: { profiles: [1, 2, 3] },
    component: MiFichaPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FichaPersonalRoutingModule {}
