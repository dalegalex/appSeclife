import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthProfileGuard } from '../../core/auth/auth.guard';
import { DRIVER_TRANSPORT_ENABLED } from '../../core/platform/platform-capabilities';
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
    redirectTo: DRIVER_TRANSPORT_ENABLED ? 'conductor' : 'padre',
    pathMatch: 'full',
  },
  {
    path: 'padre',
    canActivate: [AuthProfileGuard],
    data: { profiles: [4] },
    component: PadreDashboardPage,
  },
  ...(DRIVER_TRANSPORT_ENABLED ? [driverRoute] : []),
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TransporteEscolarRoutingModule {}
