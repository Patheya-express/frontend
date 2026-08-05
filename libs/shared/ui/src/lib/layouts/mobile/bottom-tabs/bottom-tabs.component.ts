import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BadgeComponent } from '../../../badge/badge.component';

export interface MobileBottomTabItem {
  label: string;
  path: string;
  /** Plain text/emoji/icon-font class — shared-ui ships no icon set (see README); each app
   *  supplies its own. */
  icon?: string;
  badgeCount?: number;
  /** Passed straight to `routerLinkActiveOptions`. Default `false` (a tab stays active on its own
   *  sub-routes, e.g. "Restaurants" on `/restaurants/:id`) — set `true` for a root path like `/`,
   *  which would otherwise match every route under Angular's default subset matching. */
  exact?: boolean;
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
    '[class.mobile-bottom-tabs--neo-glass]': "variant() === 'neo-glass'",
  },
  template: `
    @for (tab of tabs(); track tab.path) {
      <a
        class="mobile-bottom-tabs__tab"
        role="tab"
        [routerLink]="tab.path"
        routerLinkActive="mobile-bottom-tabs__tab--active"
        [routerLinkActiveOptions]="{ exact: tab.exact ?? false }"
        [attr.aria-label]="tab.label"
        (click)="tabSelected.emit(tab.path)"
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

    /* Neo-Glass opt-in — a modifier class on the host, not a second component. Writes the
       --neo- and --glass- prefixed custom properties directly rather than \`@use\`-ing
       neo-glass.mixins.scss from an inline \`styles\` string. */
    :host(.mobile-bottom-tabs--neo-glass) {
      border-top: none;
      background: var(--glass-surface-strong);
      backdrop-filter: blur(var(--glass-blur-md)) saturate(var(--glass-saturate));
      -webkit-backdrop-filter: blur(var(--glass-blur-md)) saturate(var(--glass-saturate));
      box-shadow: var(--neo-elevation-floating);
      padding: var(--space-1) var(--space-2);
    }

    :host(.mobile-bottom-tabs--neo-glass) .mobile-bottom-tabs__tab {
      margin: 4px 2px;
      border-radius: var(--radius-lg);
      transition: box-shadow var(--motion-duration-base) var(--motion-easing-standard);
    }

    :host(.mobile-bottom-tabs--neo-glass) .mobile-bottom-tabs__tab--active {
      background: var(--color-background);
      box-shadow: var(--neo-elevation-pressed);
    }

    @media (prefers-reduced-motion: reduce) {
      :host(.mobile-bottom-tabs--neo-glass) .mobile-bottom-tabs__tab {
        transition-duration: 1ms;
      }
    }
  `,
})
export class BottomTabsComponent {
  readonly tabs = input.required<MobileBottomTabItem[]>();
  /** Visual treatment — 'flat' (default, unchanged) keeps every existing call site as-is;
   *  'neo-glass' opts into the glass bar + soft-pressed active tab from the Neo-Glass design
   *  system. */
  readonly variant = input<'flat' | 'neo-glass'>('flat');

  /** Fires on every tab tap (navigation itself still happens via `routerLink`, unaffected by
   *  listening here too) — lets a consumer play a haptic tick on tab selection without this
   *  component injecting `HapticsService` itself. `ui` is a buildable library and `core` isn't,
   *  so Nx's module-boundary rule forbids that dependency direction; the app that already depends
   *  on both resolves the platform/haptics and reacts to this instead (see `app.ts`). */
  readonly tabSelected = output<string>();
}
