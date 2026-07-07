import { Injectable, inject } from '@angular/core';
import type { LoginDto, RegisterDto } from '@patheya-express-frontend/api-sdk';
import { AuthStore } from '../store/auth.store';

@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private readonly store = inject(AuthStore);

  readonly user = this.store.user;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly isAuthenticated = this.store.isAuthenticated;

  initialize(): void {
    this.store.initialize();
  }

  getAccessToken(): string | null {
    return this.store.getAccessToken();
  }

  register(dto: RegisterDto): Promise<boolean> {
    return this.store.register(dto);
  }

  registerDeliveryPartner(dto: RegisterDto): Promise<boolean> {
    return this.store.registerDeliveryPartner(dto);
  }

  registerRestaurantOwner(dto: RegisterDto): Promise<boolean> {
    return this.store.registerRestaurantOwner(dto);
  }

  login(dto: LoginDto): Promise<boolean> {
    return this.store.login(dto);
  }

  logout(): Promise<void> {
    return this.store.logout();
  }
}
