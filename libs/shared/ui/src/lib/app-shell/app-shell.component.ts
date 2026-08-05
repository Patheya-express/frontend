import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FooterComponent } from '../footer/footer.component';
import { HeaderComponent } from '../header/header.component';
import { BottomTabsComponent, MobileBottomTabItem } from '../layouts/mobile/bottom-tabs/bottom-tabs.component';
import { MOBILE_PAGE_TRANSITION } from '../animations/page-transition.animation';

/**
 * Reuses the same top-level routes `app.routes.ts` already defines — no new screens, no
 * mobile-specific pages. `exact: true` on Home only: without it, Angular's default (non-exact)
 * `routerLinkActive` matching would mark `/` active on every route, since every path "starts
 * with" `/` (see `MobileBottomTabItem.exact`'s doc comment).
 */
const CUSTOMER_BOTTOM_TABS: MobileBottomTabItem[] = [
  { label: 'Home', path: '/', icon: '🏠', exact: true },
  { label: 'Restaurants', path: '/restaurants', icon: '🔍' },
  { label: 'Orders', path: '/orders', icon: '🧾' },
  { label: 'Account', path: '/account', icon: '👤' },
];

@Component({
  selector: 'lib-app-shell',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, BottomTabsComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  @Input() isAuthenticated = false;
  @Input() cartItemCount = 0;
  @Input() notificationCount = 0;
  @Input() deliveryLocationLabel = 'Select a location';
  @Input() searchValue = '';
  @Input() avatarUrl?: string;
  @Input() firstName = '';

  @Output() logoutRequested = new EventEmitter<void>();
  @Output() cartToggled = new EventEmitter<void>();
  @Output() notificationsToggled = new EventEmitter<void>();
  @Output() locationPickerClicked = new EventEmitter<void>();
  @Output() searchSubmitted = new EventEmitter<string>();
  /** Forwards `BottomTabsComponent.tabSelected` — see that output's own doc comment for why this
   *  passes through rather than reacting here (this component can't inject `HapticsService`). */
  @Output() bottomTabSelected = new EventEmitter<void>();

  /** Native Android/iOS shell only — the desktop/mobile-web experience is untouched, still the
   *  existing header + footer, exactly as before this sprint. Driven by an `@Input()`, same as
   *  every other piece of shell state here, rather than this component injecting
   *  `MobilePlatformService` itself — `ui` is a buildable library and `core` isn't, so Nx's
   *  module-boundary rule forbids that dependency direction; the consuming app (which already
   *  depends on both) resolves the platform once and passes the result down. */
  @Input() isNative = false;

  protected readonly bottomTabs = CUSTOMER_BOTTOM_TABS;

  @ViewChild('pageContent') private readonly pageContent?: ElementRef<HTMLElement>;

  /**
   * `MOBILE_PAGE_TRANSITION` (see keyframes.scss) already existed but was never wired to actual
   * navigation — `<router-outlet>`'s `(activate)` fires every time a new routed component is
   * instantiated (including the first one), so this is the one hook point that covers both cold
   * load and every subsequent navigation without a Router.events subscription. A CSS `animation`
   * (unlike a `transition`) normally only plays once per class application, so remove-then-re-add
   * with a forced reflow between them is what actually retriggers it on every route change, not
   * just the first. Reduced-motion users aren't special-cased here — keyframes.scss's own
   * `@media (prefers-reduced-motion: reduce)` block already collapses this to an imperceptible 1ms.
   */
  protected onRouteActivate(): void {
    const el = this.pageContent?.nativeElement;
    if (!el) {
      return;
    }
    el.classList.remove(MOBILE_PAGE_TRANSITION.enter);
    void el.offsetWidth;
    el.classList.add(MOBILE_PAGE_TRANSITION.enter);
  }
}
