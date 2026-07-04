import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { EmptyStateComponent } from '@patheya-express-frontend/ui';
import { CartFacade } from '../../facades/cart.facade';
import { CartItemComponent } from '../cart-item/cart-item.component';
import { CartSummaryComponent } from '../cart-summary/cart-summary.component';

@Component({
  selector: 'lib-cart-drawer',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, CartItemComponent, CartSummaryComponent],
  templateUrl: './cart-drawer.component.html',
  styleUrl: './cart-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartDrawerComponent {
  @Input() open = false;
  @Output() closeRequested = new EventEmitter<void>();

  private readonly cartFacade = inject(CartFacade);
  private readonly router = inject(Router);

  protected readonly items = this.cartFacade.items;
  protected readonly error = this.cartFacade.error;

  protected close(): void {
    this.closeRequested.emit();
  }

  protected clearCart(): void {
    void this.cartFacade.clear();
  }

  protected browseRestaurants(): void {
    this.close();
    void this.router.navigateByUrl('/');
  }
}
