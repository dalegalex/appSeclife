import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthProfileGuard } from '../../core/auth/auth.guard';
import { ConductorDashboardPage } from './pages/conductor-dashboard/conductor-dashboard.page';
import { PadreDashboardPage } from './pages/padre-dashboard/padre-dashboard.page';

const driverRoute = {
  path: 'conductor',
  canActivate: [AuthProfileGuard],
  data: { profiles: [10, 11] },
  component: ConductorDashboardPage,
};

const routes: Routes = [
  {
    path: '',
    redirectTo: environment.enableDriverTransport ? 'conductor' : 'padre',
    pathMatch: 'full',
  },
  {
    path: 'padre',
    canActivate: [AuthProfileGuard],
    data: { profiles: [4] },
    component: PadreDashboardPage,
  },
  ...(environment.enableDriverTransport ? [driverRoute] : []),
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TransporteEscolarRoutingModule {}
