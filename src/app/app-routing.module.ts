import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/auth/auth.guard';

const routes: Routes = [
  {
    path: 'auth/login',
    loadChildren: () => import('./auth/login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'home',
    canActivate: [AuthGuard],
    loadChildren: () => import('./home/home.module').then( m => m.HomePageModule)
  },
  {
    path: 'transporte-escolar',
    canActivate: [AuthGuard],
    loadChildren: () => import('./modules/transporte-escolar/transporte-escolar.module').then(m => m.TransporteEscolarModule)
  },
  {
    path: 'control-accesos',
    canActivate: [AuthGuard],
    loadChildren: () => import('./modules/control-accesos/control-accesos.module').then(m => m.ControlAccesosModule)
  },
  {
    path: 'ficha-personal',
    canActivate: [AuthGuard],
    loadChildren: () => import('./modules/ficha-personal/ficha-personal.module').then(m => m.FichaPersonalModule)
  },
  {
    path: 'ficha-alumno',
    canActivate: [AuthGuard],
    loadChildren: () => import('./modules/ficha-alumno/ficha-alumno.module').then(m => m.FichaAlumnoModule)
  },
  {
    path: 'cuenta',
    canActivate: [AuthGuard],
    loadChildren: () => import('./modules/cuenta/cuenta.module').then(m => m.CuentaModule)
  },
  {
    path: 'visitantes-proveedores',
    loadChildren: () => import('./modules/visitantes-proveedores/visitantes-proveedores.module').then(m => m.VisitantesProveedoresModule)
  },
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full'
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
