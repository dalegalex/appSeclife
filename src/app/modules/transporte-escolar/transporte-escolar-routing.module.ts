import { inject, NgModule } from '@angular/core';
import { CanActivateFn, Router, RouterModule, Routes } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthProfileGuard } from '../../core/auth/auth.guard';
import { DRIVER_TRANSPORT_ENABLED } from '../../core/platform/platform-capabilities';
import { ConductorDashboardPage } from './pages/conductor-dashboard/conductor-dashboard.page';
import { PadreDashboardPage } from './pages/padre-dashboard/padre-dashboard.page';

export const transporteOperadorGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  return [1, 10, 11].includes(auth.getCurrentProfileId() ?? 0) || router.createUrlTree(['/home']);
};

const driverRoute = {
  path: 'conductor',
  canActivate: [transporteOperadorGuard],
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
