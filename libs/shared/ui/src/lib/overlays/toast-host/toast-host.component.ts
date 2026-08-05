import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
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
    '[class.mobile-toast-host--native]': 'isNative',
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

    /* Native Android/iOS shell only — clears AppShellComponent's fixed bottom tab bar (its own
       height, ~--touch-target-large + safe-area-bottom), which the plain "safe-area-bottom" host
       class alone doesn't account for (that only covers the OS-level inset, not this app's own
       tab bar sitting on top of it). Driven by an \`@Input()\` rather than injecting
       MobilePlatformService directly — \`ui\` is a buildable library and \`core\` isn't, so Nx's
       module-boundary rule forbids that dependency direction (same reasoning as
       AppShellComponent); the consuming app resolves the platform once and passes it down. */
    :host(.mobile-toast-host--native) {
      bottom: calc(var(--touch-target-large) + var(--space-4));
    }
  `,
})
export class ToastHostComponent {
  protected readonly toastService = inject(ToastService);

  @Input() isNative = false;
}
