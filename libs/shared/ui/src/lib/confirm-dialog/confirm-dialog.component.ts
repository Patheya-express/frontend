import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'lib-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  @Input() open = false;
  @Input() title = 'Are you sure?';
  @Input() message?: string;
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  /** Disables both actions while a confirmed action is still in flight, to prevent duplicate submissions. */
  @Input() busy = false;
  @Input() tone: 'default' | 'danger' = 'default';

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  protected onCancel(): void {
    if (this.busy) {
      return;
    }
    this.cancelled.emit();
  }

  protected onConfirm(): void {
    if (this.busy) {
      return;
    }
    this.confirmed.emit();
  }
}
