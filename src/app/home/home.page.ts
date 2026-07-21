import { Component, OnInit, computed, signal } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  private readonly adminProfiles = [1, 2, 3];
  readonly organizationLogo = signal<string | null>(null);
  readonly organizationLogoContentType = signal<string | null>(null);
  readonly organizationLogoSrc = computed(() => this.resolveLogoSrc(this.organizationLogo(), this.organizationLogoContentType()));

  constructor(public readonly authService: AuthService) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    this.authService.getOrganizationBrand().subscribe({
      next: brand => {
        this.organizationLogo.set(brand.logoorg ?? null);
        this.organizationLogoContentType.set(brand.logoContentType ?? null);
      },
      error: () => {
        this.organizationLogo.set(null);
        this.organizationLogoContentType.set(null);
      },
    });
  }

  canUseConductor(): boolean {
    return this.isProfileAllowed([10, 11]);
  }

  canUsePadre(): boolean {
    return this.canUseFamilyAccess();
  }

  canUseControlAccesos(): boolean {
    return this.isProfileAllowed([]);
  }

  canUseFichaPersonal(): boolean {
    return this.isProfileAllowed([]);
  }

  canUseFichaAlumno(): boolean {
    return this.canUseFamilyAccess();
  }

  canUseRedFamiliar(): boolean {
    return this.canUseFamilyAccess();
  }

  canUseCredencialDigital(): boolean {
    return !!this.authService.getCurrentProfileId();
  }

  private isProfileAllowed(profiles: number[]): boolean {
    const profileId = this.authService.getCurrentProfileId();
    return !!profileId && [...profiles, ...this.adminProfiles].includes(profileId);
  }

  private canUseFamilyAccess(): boolean {
    return this.isProfileAllowed([4]) || this.authService.hasFamilyAccess();
  }

  private resolveLogoSrc(logo: string | null, contentType: string | null): string | null {
    const value = logo?.trim();
    if (!value) {
      return null;
    }

    return value.startsWith('data:image/')
      ? value
      : `data:${contentType || 'image/png'};base64,${value}`;
  }
}
