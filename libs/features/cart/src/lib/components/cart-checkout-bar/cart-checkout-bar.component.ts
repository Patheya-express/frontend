import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { CartFacade } from '../../facades/cart.facade';

/** Routes where the cart is already the focus (or not reachable) — showing the bar there would be redundant. */
const HIDDEN_ROUTE_PREFIXES = ['/cart', '/checkout', '/auth'];

function isHiddenRoute(url: string): boolean {
  const path = url.split('?')[0];
  return HIDDEN_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * Persistent floating bar offering a direct path to checkout once the cart has items, so that
 * path isn't buried behind header cart icon -> drawer -> "View full cart" -> cart page.
 */
@Component({
  selector: 'lib-cart-checkout-bar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cart-checkout-bar.component.html',
  styleUrl: './cart-checkout-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartCheckoutBarComponent {
  private readonly cartFacade = inject(CartFacade);
  private readonly router = inject(Router);

  private readonly _drawerOpen = signal(false);

  /** Suppresses the bar while the cart drawer is already open, to avoid redundant UI. */
  @Input()
  set drawerOpen(value: boolean) {
    this._drawerOpen.set(value);
  }
  get drawerOpen(): boolean {
    return this._drawerOpen();
  }

  protected readonly totalItems = this.cartFacade.totalItems;
  protected readonly subtotal = this.cartFacade.subtotal;

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly visible = computed(
    () => this.totalItems() > 0 && !this._drawerOpen() && !isHiddenRoute(this.currentUrl()),
  );
}
