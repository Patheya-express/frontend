import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CartFacade } from '../../facades/cart.facade';

@Component({
  selector: 'lib-cart-conflict-dialog',
  standalone: true,
  templateUrl: './cart-conflict-dialog.component.html',
  styleUrl: './cart-conflict-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartConflictDialogComponent {
  private readonly cartFacade = inject(CartFacade);

  protected readonly pendingConflict = this.cartFacade.pendingConflict;
  protected readonly currentRestaurantName = computed(() => this.cartFacade.items()[0]?.restaurantName ?? '');

  protected confirm(): void {
    void this.cartFacade.confirmReplaceCart();
  }

  protected cancel(): void {
    this.cartFacade.cancelPendingAdd();
  }
}
