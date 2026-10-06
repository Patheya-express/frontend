import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BottomSheetComponent, EmptyStateComponent, IconButtonComponent } from '@patheya-express-frontend/ui';
import { MobilePlatformService } from '@patheya-express-frontend/core';
import { CartFacade } from '../../facades/cart.facade';
import { CartItemComponent } from '../cart-item/cart-item.component';
import { CartSummaryComponent } from '../cart-summary/cart-summary.component';

@Component({
  selector: 'lib-cart-drawer',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, CartItemComponent, CartSummaryComponent, BottomSheetComponent, IconButtonComponent],
  templateUrl: './cart-drawer.component.html',
  styleUrl: './cart-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // BottomSheetComponent itself has no Escape handling (only the service-driven
    // BottomSheetHostComponent does) — this drawer is mounted directly in app.html, not through
    // BottomSheetService, so it keeps its own listener from the UI-1A pass.
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class CartDrawerComponent {
  @Input() open = false;
  @Output() closeRequested = new EventEmitter<void>();

  private readonly cartFacade = inject(CartFacade);
  private readonly router = inject(Router);

  /** Native Android/iOS shell only — pushes the footer's bottom padding out to clear
   *  AppShellComponent's fixed bottom tab bar, same pattern as `CartCheckoutBarComponent` in this
   *  same library. */
  protected readonly isNative = inject(MobilePlatformService).isNative();

  protected readonly items = this.cartFacade.items;
  protected readonly error = this.cartFacade.error;

  protected close(): void {
    this.closeRequested.emit();
  }

  protected onEscape(): void {
    if (this.open) {
      this.close();
    }
  }

  protected clearCart(): void {
    void this.cartFacade.clear();
  }

  protected browseRestaurants(): void {
    this.close();
    void this.router.navigateByUrl('/');
  }
}
