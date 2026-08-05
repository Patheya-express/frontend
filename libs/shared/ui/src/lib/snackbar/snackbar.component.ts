import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { NotificationAction } from '../types/overlay.types';
import type { MobileTone } from '../types/common.types';
import { MOBILE_TOAST_TRANSITION } from '../animations/toast.animation';

/**
 * Transient message that can carry one action button ("Undo", "Retry"). Rendered by
 * `ToastHostComponent`; not normally instantiated directly — call `ToastService.showSnackbar()`
 * instead.
 */
@Component({
  selector: 'lib-snackbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    'aria-live': 'polite',
    '[class]': '"mobile-snackbar mobile-snackbar--" + tone() + " " + (leaving() ? transition.leave : transition.enter)',
  },
  template: `
    <span class="mobile-snackbar__message">{{ message() }}</span>
    @if (action(); as action) {
      <button
        type="button"
        class="mobile-snackbar__action"
        (click)="onAction(action)"
      >
        {{ action.label }}
      </button>
    }
  `,
  styles: `
    .mobile-snackbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      min-height: var(--touch-target-comfortable);
      padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      background: var(--color-secondary);
      color: var(--color-text-on-primary);
      font-size: var(--font-size-sm);
      box-shadow: var(--elevation-3);
    }

    .mobile-snackbar--error {
      background: var(--color-error);
    }

    .mobile-snackbar__message {
      flex: 1;
    }

    .mobile-snackbar__action {
      flex-shrink: 0;
      min-height: var(--touch-target-min);
      padding: 0 var(--space-3);
      border: none;
      background: transparent;
      color: inherit;
      font-weight: var(--font-weight-semibold);
      font-size: var(--font-size-sm);
      cursor: pointer;
    }
  `,
})
export class SnackbarComponent {
  protected readonly transition = MOBILE_TOAST_TRANSITION;

  readonly message = input.required<string>();
  readonly tone = input<MobileTone>('neutral');
  readonly action = input<NotificationAction | undefined>(undefined);
  /** Set by ToastHostComponent while this snackbar is playing its leave animation. */
  readonly leaving = input(false);
  readonly dismissed = output<void>();

  onAction(action: NotificationAction): void {
    action.onAction();
    this.dismissed.emit();
  }
}
