import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  canActivate(): boolean | UrlTree {
    return this.authService.isAuthenticated()
      ? true
      : this.router.createUrlTree(['/auth/login']);
  }
}

@Injectable({
  providedIn: 'root',
})
export class AuthProfileGuard implements CanActivate {
  private readonly adminProfiles = [1, 2, 3];

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    if (!this.authService.isAuthenticated()) {
      return this.router.createUrlTree(['/auth/login']);
    }

    const profileId = this.authService.getCurrentProfileId();
    const allowedProfiles = route.data['profiles'] as number[] | undefined;

    if (
      !allowedProfiles?.length
      || (profileId && [...allowedProfiles, ...this.adminProfiles].includes(profileId))
      || (allowedProfiles.includes(4) && this.authService.hasFamilyAccess())
    ) {
      return true;
    }

    return this.router.createUrlTree(['/home']);
  }
}
