import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NetworkStatusService } from '../services/network-status.service';

/**
 * Compact inline connection indicator (dot + label) — usable anywhere (header, settings screen),
 * unlike `OfflineBannerComponent` which is a full-width banner meant for one fixed placement.
 *
 * @example <lib-network-status />
 */
@Component({
  selector: 'lib-network-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    '[class.mobile-network-status--offline]': 'networkStatus.isOffline()',
  },
  template: `
    <span class="mobile-network-status__dot" aria-hidden="true"></span>
    <span class="mobile-network-status__label">{{ label() }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      color: var(--color-text-muted);
      font-size: var(--font-size-xs);
    }

    .mobile-network-status__dot {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);
      background: var(--color-success);
    }

    :host(.mobile-network-status--offline) .mobile-network-status__dot {
      background: var(--color-error);
    }

    :host(.mobile-network-status--offline) {
      color: var(--color-error);
    }
  `,
})
export class NetworkStatusComponent {
  protected readonly networkStatus = inject(NetworkStatusService);
  protected readonly label = computed(() => (this.networkStatus.isOffline() ? 'Offline' : 'Online'));
}
