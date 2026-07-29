import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastComponent } from '../../toast/toast.component';
import { SnackbarComponent } from '../../snackbar/snackbar.component';
import { ToastService } from '../../services/toast.service';

/**
 * Renders whichever notification `ToastService` currently has queued — mount once, near the app
 * root (`MobileShellComponent` does this automatically). Picks `ToastComponent` vs
 * `SnackbarComponent` per entry's `variant`; the queueing/auto-dismiss timing lives entirely in
 * `ToastService`, not here.
 */
@Component({
  selector: 'lib-toast-host',
  standalone: true,
  imports: [ToastComponent, SnackbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mobile-toast-host safe-area-bottom',
  },
  template: `
    @if (toastService.current(); as entry) {
      @if (entry.variant === 'toast') {
        <lib-toast
          [message]="entry.message"
          [tone]="entry.tone ?? 'neutral'"
          (dismissed)="toastService.dismiss(entry.id)"
        />
      } @else {
        <lib-snackbar
          [message]="entry.message"
          [tone]="entry.tone ?? 'neutral'"
          [action]="entry.action"
          (dismissed)="toastService.dismiss(entry.id)"
        />
      }
    }
  `,
  styles: `
    :host {
      position: fixed;
      inset-inline: var(--space-4);
      bottom: var(--space-4);
      z-index: var(--z-index-toast);
      display: flex;
      justify-content: center;
      pointer-events: none;
    }

    :host > * {
      pointer-events: auto;
      width: 100%;
      max-width: 480px;
    }
  `,
})
export class ToastHostComponent {
  protected readonly toastService = inject(ToastService);
}
