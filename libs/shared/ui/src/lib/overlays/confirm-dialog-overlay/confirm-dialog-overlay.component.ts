import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ConfirmDialogComponent } from '../../confirm-dialog/confirm-dialog.component';
import { DialogService } from '../../services/dialog.service';

export interface ConfirmDialogOverlayData {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

/**
 * Thin adapter implementing the overlay content contract (`data`/`overlayId` inputs — see
 * `ModalHostComponent`'s doc comment) for `DialogService`-driven confirmation flows. Owns zero
 * dialog markup of its own — delegates entirely to the existing `ConfirmDialogComponent`
 * (`lib-confirm-dialog`, already used declaratively — `[open]="show()"` — across ~60 call sites),
 * so there is exactly one confirmation-dialog UI in the whole workspace, reachable two ways
 * (declarative binding, or imperatively via `confirmDialog()` below) rather than two
 * implementations.
 */
@Component({
  selector: 'lib-confirm-dialog-overlay',
  standalone: true,
  imports: [ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lib-confirm-dialog
      [open]="true"
      [title]="data().title"
      [message]="data().message"
      [confirmLabel]="data().confirmLabel ?? 'Confirm'"
      [cancelLabel]="data().cancelLabel ?? 'Cancel'"
      [tone]="data().tone ?? 'default'"
      (confirmed)="onConfirm()"
      (cancelled)="onCancel()"
    />
  `,
})
export class ConfirmDialogOverlayComponent {
  readonly data = input.required<ConfirmDialogOverlayData>();
  readonly overlayId = input.required<string>();

  private readonly dialogService = inject(DialogService) as DialogService<
    ConfirmDialogOverlayData,
    boolean
  >;

  onConfirm(): void {
    this.dialogService.close(this.overlayId(), true);
  }

  onCancel(): void {
    this.dialogService.close(this.overlayId(), false);
  }
}

/**
 * Convenience wrapper around `DialogService.open(ConfirmDialogOverlayComponent, …)` for the
 * common "are you sure?" case — lives next to the adapter (rather than as a method on
 * `DialogService` itself) so the generic overlay service stays fully decoupled from any one
 * dialog's content.
 *
 * @example
 * const confirmed = await confirmDialog(this.dialogService, {
 *   title: 'Cancel this order?',
 *   tone: 'danger',
 * });
 */
export function confirmDialog(
  dialogService: DialogService<ConfirmDialogOverlayData, boolean>,
  data: ConfirmDialogOverlayData,
): Promise<boolean> {
  return dialogService
    .open(ConfirmDialogOverlayComponent, { data, ariaLabel: data.title })
    .afterClosed()
    .then((result) => result ?? false);
}
