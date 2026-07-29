import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ButtonBase } from '../../buttons/button-base';

export type LinkButtonTone = 'primary' | 'neutral' | 'danger';

/**
 * Text-only action link (View / Edit / Approve / Reject / Retry …) — for the many lightweight,
 * inline table-row/list actions that are neither a filled `PrimaryButtonComponent` nor an
 * outlined `SecondaryButtonComponent`. Renders as a real `<button>` (keyboard/AT-accessible),
 * styled with no background or border, matching this workspace's existing hand-rolled
 * `*-action-link` pattern rather than introducing a new visual language.
 *
 * @example
 * <lib-link-button (buttonClick)="viewOrder(order)">View</lib-link-button>
 * <lib-link-button tone="danger" (buttonClick)="reject(order)">Reject</lib-link-button>
 */
@Component({
  selector: 'lib-link-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './link-button.component.html',
  styleUrl: './link-button.component.scss',
})
export class LinkButtonComponent extends ButtonBase {
  readonly tone = input<LinkButtonTone>('primary');
}
