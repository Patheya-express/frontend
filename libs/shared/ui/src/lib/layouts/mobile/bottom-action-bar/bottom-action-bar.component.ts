import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Sticky bottom bar for a screen's primary action(s) (checkout's "Place order" bar, an item
 * page's "Add to cart" bar) — safe-area-bottom aware so it never sits under the iOS home
 * indicator or an Android gesture bar.
 *
 * @example
 * <mobile-bottom-action-bar>
 *   <span>₹450</span>
 *   <lib-primary-button [fullWidth]="true" (buttonClick)="checkout()">Checkout</lib-primary-button>
 * </mobile-bottom-action-bar>
 */
@Component({
  selector: 'mobile-bottom-action-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'safe-area-bottom',
  },
  template: `<ng-content />`,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface);
      border-top: 1px solid var(--color-border);
      box-shadow: var(--elevation-2);
    }
  `,
})
export class BottomActionBarComponent {}
