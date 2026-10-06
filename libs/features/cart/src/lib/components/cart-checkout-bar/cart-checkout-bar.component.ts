import { ChangeDetectionStrategy, Component, Input, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { MobilePlatformService } from '@patheya-express-frontend/core';
import { MOBILE_MOTION_DURATIONS_MS, prefersReducedMotion } from '@patheya-express-frontend/ui';
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

  /** Native Android/iOS shell only — pushes this bar up above `AppShellComponent`'s fixed bottom
   *  tab bar (see app-shell.component.scss); on web there's no tab bar to clear. */
  protected readonly isNative = inject(MobilePlatformService).isNative();

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

  /** The real visibility condition. Renamed from the old `visible` so that name is free for the
   *  DOM-presence signal below, which lags one leave-animation behind this on the way out — see
   *  that signal's own doc comment for why. */
  protected readonly shouldShow = computed(
    () => this.totalItems() > 0 && !this._drawerOpen() && !isHiddenRoute(this.currentUrl()),
  );

  /**
   * Gates the template's `@if`, one leave-animation duration behind `shouldShow` on the way out
   * so `.mobile-anim-fab-leave` (see the template) actually gets to play before Angular removes
   * the element — a plain `@if (shouldShow())` would destroy it mid-frame instead. Immediate on
   * the way in. Same pattern already used by `ConfirmDialogComponent` for the same reason (Angular
   * template control flow has no built-in "wait for the leave animation" hook the way
   * `animate.leave` does). Skips the delay entirely under `prefers-reduced-motion` so a
   * accessibility-motion-sensitive user isn't left waiting on an animation that isn't playing.
   */
  protected readonly visible = signal(false);
  private hideTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      if (this.shouldShow()) {
        clearTimeout(this.hideTimeout);
        this.visible.set(true);
        return;
      }

      if (!this.visible()) {
        return;
      }

      if (prefersReducedMotion()) {
        this.visible.set(false);
        return;
      }

      this.hideTimeout = setTimeout(() => this.visible.set(false), MOBILE_MOTION_DURATIONS_MS.fast);
    });
  }
}
