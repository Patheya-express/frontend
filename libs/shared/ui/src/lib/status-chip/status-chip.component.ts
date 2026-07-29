import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export type StatusChipTone = 'neutral' | 'info' | 'success' | 'error';

/**
 * Generic status pill — and, with `selectable`/`removable`, the workspace's one interactive chip
 * too (filter chips, removable tags). Unlike OrderStatusBadgeComponent, it has no built-in status
 * vocabulary — callers map their own domain status to a label/tone, keeping this reusable across
 * features. `selectable`/`removable` default to `false`/non-interactive, so every existing
 * read-only usage (order/delivery status pills) is completely unaffected.
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
  @Input() selectable = false;
  @Input() selected = false;
  @Input() removable = false;

  @Output() chipClick = new EventEmitter<void>();
  @Output() removed = new EventEmitter<void>();

  protected get interactive(): boolean {
    return this.selectable || this.removable;
  }

  protected onActivate(event?: Event): void {
    if (!this.selectable) {
      return;
    }

    event?.preventDefault();
    this.chipClick.emit();
  }

  protected onRemove(event: Event): void {
    event.stopPropagation();
    this.removed.emit();
  }
}
