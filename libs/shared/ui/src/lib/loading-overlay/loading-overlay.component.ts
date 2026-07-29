import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProgressIndicatorComponent } from '../progress-indicator/progress-indicator.component';

/**
 * Blocks interaction with whatever it's placed inside (position it inside a `position: relative`
 * container) while an async operation is in flight — e.g. over a form while it submits. For a
 * whole-page loading state, see `EmptyStateComponent`'s loading affordance is NOT this; use this
 * one specifically for "temporarily blocking an already-visible screen", not first paint.
 *
 * @example
 * <div class="cart-drawer" style="position: relative">
 *   @if (isSubmitting()) { <lib-loading-overlay message="Placing order…" /> }
 *   …
 * </div>
 */
@Component({
  selector: 'lib-loading-overlay',
  standalone: true,
  imports: [ProgressIndicatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'alert',
    'aria-live': 'assertive',
  },
  template: `
    <lib-progress-indicator variant="circular" [ariaLabel]="message() ?? 'Loading'" />
    @if (message()) {
      <p class="mobile-loading-overlay__message">{{ message() }}</p>
    }
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      z-index: var(--z-index-sticky);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      background: color-mix(in srgb, var(--color-surface) 88%, transparent);
    }

    .mobile-loading-overlay__message {
      margin: 0;
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
  `,
})
export class LoadingOverlayComponent {
  readonly message = input<string | undefined>(undefined);
}
