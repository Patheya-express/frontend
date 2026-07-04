import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { EmptyStateComponent, ErrorStateComponent, SkeletonComponent } from '@patheya-express-frontend/ui';
import { CartFacade, CartItemComponent, CartSummaryComponent } from '@patheya-express-frontend/cart';

@Component({
  selector: 'lib-cart-page',
  standalone: true,
  imports: [RouterLink, SkeletonComponent, EmptyStateComponent, ErrorStateComponent, CartItemComponent, CartSummaryComponent],
  templateUrl: './cart-page.component.html',
  styleUrl: './cart-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPageComponent {
  private readonly cartFacade = inject(CartFacade);
  private readonly router = inject(Router);

  protected readonly items = this.cartFacade.items;
  protected readonly loading = this.cartFacade.loading;
  protected readonly error = this.cartFacade.error;

  protected retry(): void {
    void this.cartFacade.restore();
  }

  protected clearCart(): void {
    void this.cartFacade.clear();
  }

  protected browseRestaurants(): void {
    void this.router.navigateByUrl('/');
  }
}
