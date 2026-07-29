import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BadgeComponent } from '../../../badge/badge.component';

export interface MobileBottomTabItem {
  label: string;
  path: string;
  /** Plain text/emoji/icon-font class — shared-ui ships no icon set (see README); each app
   *  supplies its own. */
  icon?: string;
  badgeCount?: number;
}

/**
 * Bottom tab bar — active-tab state comes straight from Angular's own `routerLink`/
 * `routerLinkActive`; there's no custom "which tab is active" tracking here, since re-deriving
 * that from the router would just duplicate what the framework already does correctly.
 *
 * @example
 * <mobile-bottom-tabs
 *   [tabs]="[
 *     { label: 'Home', path: '/home', icon: '🏠' },
 *     { label: 'Orders', path: '/orders', icon: '🧾', badgeCount: activeOrderCount() },
 *   ]"
 * />
 */
@Component({
  selector: 'mobile-bottom-tabs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'tablist',
    class: 'mobile-bottom-tabs safe-area-bottom',
  },
  template: `
    @for (tab of tabs(); track tab.path) {
      <a
        class="mobile-bottom-tabs__tab"
        role="tab"
        [routerLink]="tab.path"
        routerLinkActive="mobile-bottom-tabs__tab--active"
        [attr.aria-label]="tab.label"
      >
        <span class="mobile-bottom-tabs__icon">
          {{ tab.icon }}
          @if (tab.badgeCount) {
            <lib-badge class="mobile-bottom-tabs__badge" [count]="tab.badgeCount" />
          }
        </span>
        <span class="mobile-bottom-tabs__label">{{ tab.label }}</span>
      </a>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: stretch;
      justify-content: space-around;
      border-top: 1px solid var(--color-border);
      background: var(--color-surface);
      z-index: var(--z-index-bottom-tabs);
    }

    .mobile-bottom-tabs__tab {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      flex: 1;
      min-height: var(--touch-target-large);
      color: var(--color-text-muted);
      text-decoration: none;
      font-size: var(--font-size-xs);
    }

    .mobile-bottom-tabs__tab--active {
      color: var(--color-primary);
      font-weight: var(--font-weight-semibold);
    }

    .mobile-bottom-tabs__icon {
      position: relative;
      font-size: var(--font-size-lg);
      line-height: 1;
    }

    .mobile-bottom-tabs__badge {
      position: absolute;
      top: -6px;
      right: -10px;
    }
  `,
})
export class BottomTabsComponent {
  readonly tabs = input.required<MobileBottomTabItem[]>();
}
