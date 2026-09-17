import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AutoFocusDirective, FocusTrapDirective } from '@patheya-express-frontend/ui';
import { CartFacade } from '../../facades/cart.facade';

@Component({
  selector: 'lib-cart-conflict-dialog',
  standalone: true,
  imports: [AutoFocusDirective, FocusTrapDirective],
  templateUrl: './cart-conflict-dialog.component.html',
  styleUrl: './cart-conflict-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class CartConflictDialogComponent {
  private readonly cartFacade = inject(CartFacade);

  protected readonly pendingConflict = this.cartFacade.pendingConflict;
  protected readonly currentRestaurantName = this.cartFacade.restaurantName;

  protected confirm(): void {
    void this.cartFacade.confirmReplaceCart();
  }

  protected cancel(): void {
    this.cartFacade.cancelPendingAdd();
  }

  protected onEscape(): void {
    if (this.pendingConflict()) {
      this.cancel();
    }
  }
}
