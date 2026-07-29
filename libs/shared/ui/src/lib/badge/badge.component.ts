import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { MobileTone } from '../types/common.types';

/**
 * Small numeric/dot indicator (unread counts, cart item counts, …) — generic and domain-agnostic,
 * unlike `@patheya-express-frontend/ui`'s `NotificationBadgeComponent`/`CartBadgeComponent`
 * (which are purpose-built for the web header's specific notification/cart icons). A future
 * mobile screen wanting a badge on an arbitrary icon uses this instead of those.
 *
 * @example <lib-badge [count]="unreadCount()" />
 * @example <lib-badge dot tone="error" /> <!-- unread dot, no number -->
 */
@Component({
  selector: 'lib-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()',
    '[attr.aria-hidden]': 'dot() ? "true" : null',
    '[style.display]': 'shouldHide() ? "none" : null',
  },
  template: `
    @if (!dot()) {
      {{ displayValue() }}
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: var(--radius-full);
      background: var(--color-error);
      color: var(--color-text-on-primary);
      font-size: 11px;
      font-weight: var(--font-weight-semibold);
      line-height: 1;
    }

    :host(.mobile-badge--dot) {
      min-width: 8px;
      width: 8px;
      height: 8px;
      padding: 0;
    }

    :host(.mobile-badge--neutral) {
      background: var(--color-secondary);
    }

    :host(.mobile-badge--success) {
      background: var(--color-success);
    }

    :host(.mobile-badge--info) {
      background: var(--color-primary);
    }
  `,
})
export class BadgeComponent {
  readonly count = input(0);
  readonly max = input(99);
  readonly dot = input(false);
  readonly tone = input<MobileTone>('error');

  protected readonly hostClass = computed(
    () => `mobile-badge mobile-badge--${this.tone()}${this.dot() ? ' mobile-badge--dot' : ''}`,
  );

  protected readonly displayValue = computed(() =>
    this.count() > this.max() ? `${this.max()}+` : `${this.count()}`,
  );

  /** Hide entirely at zero — a badge showing "0" reads as noise, not information. `dot` mode is
   *  exempt: callers use it for a plain "unread exists" indicator with no count semantics. */
  protected readonly shouldHide = computed(() => !this.dot() && this.count() <= 0);
}
