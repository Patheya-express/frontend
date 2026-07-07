import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppShellComponent } from '@patheya-express-frontend/ui';
import { AuthFacade } from '@patheya-express-frontend/auth';
import {
  CartCheckoutBarComponent,
  CartConflictDialogComponent,
  CartDrawerComponent,
  CartFacade,
} from '@patheya-express-frontend/cart';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [AppShellComponent, CartDrawerComponent, CartConflictDialogComponent, CartCheckoutBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly authFacade = inject(AuthFacade);
  private readonly cartFacade = inject(CartFacade);
  private readonly router = inject(Router);

  protected readonly isAuthenticated = this.authFacade.isAuthenticated;
  protected readonly cartItemCount = this.cartFacade.totalItems;
  protected readonly cartOpen = signal(false);

  protected async onLogout(): Promise<void> {
    await this.authFacade.logout();
    await this.router.navigateByUrl('/auth/login');
  }

  protected toggleCart(): void {
    this.cartOpen.update((open) => !open);
  }

  protected closeCart(): void {
    this.cartOpen.set(false);
  }
}
