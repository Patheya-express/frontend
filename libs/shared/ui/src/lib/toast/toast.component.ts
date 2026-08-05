import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { MobileTone } from '../types/common.types';
import { MOBILE_TOAST_TRANSITION } from '../animations/toast.animation';

/**
 * Glanceable, non-interactive transient message — no action button (use `SnackbarComponent` for
 * that). Rendered by `ToastHostComponent`; not normally instantiated directly — call
 * `ToastService.showToast()` instead.
 */
@Component({
  selector: 'lib-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    'aria-live': 'polite',
    '[class]': '"mobile-toast mobile-toast--" + tone() + " " + (leaving() ? transition.leave : transition.enter)',
  },
  template: `
    <span class="mobile-toast__message">{{ message() }}</span>
  `,
  styles: `
    .mobile-toast {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--touch-target-min);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      background: var(--color-secondary);
      color: var(--color-text-on-primary);
      font-size: var(--font-size-sm);
      box-shadow: var(--elevation-3);
    }

    .mobile-toast--error {
      background: var(--color-error);
    }

    .mobile-toast--success {
      background: var(--color-success);
    }
  `,
})
export class ToastComponent {
  protected readonly transition = MOBILE_TOAST_TRANSITION;

  readonly message = input.required<string>();
  readonly tone = input<MobileTone>('neutral');
  /** Set by ToastHostComponent while this toast is playing its leave animation — see that
   *  component's doc comment for why the leave timing lives there, not in ToastService. */
  readonly leaving = input(false);
  readonly dismissed = output<void>();
}
