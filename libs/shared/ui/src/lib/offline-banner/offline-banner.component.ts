import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NetworkStatusService } from '../services/network-status.service';

/**
 * Full-width persistent banner shown only while `NetworkStatusService.isOffline()` is true —
 * place once near the top of `MobileShellComponent`'s content area. For a compact, always-visible
 * connection indicator instead (e.g. in a header), use `NetworkStatusComponent`.
 *
 * @example <lib-offline-banner />
 */
@Component({
  selector: 'lib-offline-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    'aria-live': 'assertive',
    class: 'safe-area-top',
    '[style.display]': "networkStatus.isOffline() ? 'flex' : 'none'",
  },
  template: `You're offline — some actions may not work until you reconnect.`,
  styles: `
    :host {
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      min-height: var(--touch-target-min);
      padding: var(--space-2) var(--space-4);
      background: var(--color-error);
      color: var(--color-text-on-primary);
      font-size: var(--font-size-sm);
      text-align: center;
    }
  `,
})
export class OfflineBannerComponent {
  protected readonly networkStatus = inject(NetworkStatusService);
}
