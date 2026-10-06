import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { ConfirmDialogComponent } from '@patheya-express-frontend/ui';
import type { AddToCartRequest } from '../../store/cart.store';
import { CartFacade } from '../../facades/cart.facade';

@Component({
  selector: 'lib-cart-conflict-dialog',
  standalone: true,
  imports: [ConfirmDialogComponent],
  templateUrl: './cart-conflict-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartConflictDialogComponent {
  private readonly cartFacade = inject(CartFacade);

  protected readonly pendingConflict = this.cartFacade.pendingConflict;
  protected readonly currentRestaurantName = this.cartFacade.restaurantName;

  /** Last known non-null conflict, kept around purely so ConfirmDialogComponent's own leave
   *  animation (see its `visible` doc comment) has content to fade out — `pendingConflict()` is
   *  cleared the instant confirm/cancel resolves, before that animation gets to play. Not part of
   *  the conflict-resolution state machine; animation support only. */
  protected readonly displayConflict = signal<AddToCartRequest | null>(null);

  constructor() {
    effect(() => {
      const conflict = this.pendingConflict();
      if (conflict) {
        this.displayConflict.set(conflict);
      }
    });
  }

  protected confirm(): void {
    void this.cartFacade.confirmReplaceCart();
  }

  protected cancel(): void {
    this.cartFacade.cancelPendingAdd();
  }

  /** ConfirmDialogComponent's `message` is plain text only (matching all ~24 other call sites in
   *  the workspace) — the previous bespoke markup bolded both restaurant names inline
   *  (`Your cart has items from <strong>X</strong>...`); that emphasis is dropped here rather than
   *  adding rich-content support to the shared dialog for this one consumer. Wording is unchanged. */
  protected conflictMessage(conflict: AddToCartRequest): string {
    // `?? ''` matches Angular interpolation's own null/undefined-to-empty-string coercion — the
    // original template used `{{ currentRestaurantName() }}` directly, which never rendered the
    // literal word "undefined" the way a template literal otherwise would.
    return `Your cart has items from ${this.currentRestaurantName() ?? ''}. Adding an item from ${conflict.restaurantName} will clear your current cart.`;
  }
}
