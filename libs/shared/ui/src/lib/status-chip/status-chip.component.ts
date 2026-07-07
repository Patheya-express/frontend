import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type StatusChipTone = 'neutral' | 'info' | 'success' | 'error';

/**
 * Generic status pill. Unlike OrderStatusBadgeComponent, it has no built-in status vocabulary —
 * callers map their own domain status to a label/tone, keeping this reusable across features.
 */
@Component({
  selector: 'lib-status-chip',
  standalone: true,
  templateUrl: './status-chip.component.html',
  styleUrl: './status-chip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusChipComponent {
  @Input({ required: true }) label!: string;
  @Input() tone: StatusChipTone = 'neutral';
}
