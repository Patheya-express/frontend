import { Injectable } from '@angular/core';
import { OverlayStackService } from './overlay-stack.service';

export interface ConfirmationDialogData {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'neutral' | 'error';
}

/**
 * Opens a small, focused, blocking overlay (confirmations, short forms) — pair with
 * `DialogHostComponent` placed once near the app root. For the common "are you sure?" case, use
 * the `confirmDialog()` helper exported alongside `ConfirmationDialogComponent` rather than
 * calling `open()` directly — it also owns the `boolean` result contract.
 *
 * @example
 * const ref = this.dialogService.open(EditNoteDialogComponent, { data: { note } });
 * const updatedNote = await ref.afterClosed();
 */
@Injectable({ providedIn: 'root' })
export class DialogService<TData = unknown, TResult = unknown> extends OverlayStackService<
  TData,
  TResult
> {}
