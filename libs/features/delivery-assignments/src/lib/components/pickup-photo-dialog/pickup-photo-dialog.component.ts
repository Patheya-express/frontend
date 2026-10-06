import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { ConfirmDialogComponent, FileUploadComponent } from '@patheya-express-frontend/ui';
import type { PickupPhotoDialogState } from '../../store/delivery-assignments.store';
import { DeliveryAssignmentsFacade } from '../../facades/delivery-assignments.facade';

/**
 * Business requirement (delivery parcel photo + customer confirmation + OTP-gated delivery) —
 * mandatory pickup-parcel photo capture. Self-contained like ProofOtpDialogComponent (reads the
 * facade directly), since it owns the same shape of local state (a not-yet-submitted selection
 * the rider can retake before confirming — see PickupPhotoDialogState's doc comment). Reuses
 * FileUploadComponent for the actual picker; `capture="environment"` makes mobile
 * browsers/WebViews open the native camera directly with no Capacitor plugin involved. Chrome
 * (backdrop, focus trap, initial focus, Escape, dialog semantics, animation) comes from
 * ConfirmDialogComponent — this component only supplies the two actions and, via the
 * `[dialogContent]` slot, the file-upload widget the shared dialog's plain-text `message` can't
 * represent.
 */
@Component({
  selector: 'lib-pickup-photo-dialog',
  standalone: true,
  imports: [ConfirmDialogComponent, FileUploadComponent],
  templateUrl: './pickup-photo-dialog.component.html',
  styleUrl: './pickup-photo-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PickupPhotoDialogComponent {
  protected readonly facade = inject(DeliveryAssignmentsFacade);

  /** Last known non-null dialog state, kept around purely so ConfirmDialogComponent's own leave
   *  animation (see its `visible` doc comment) has content to fade out — `pickupPhotoDialog()` is
   *  cleared the instant the upload succeeds, before that animation gets to play. Not part of the
   *  upload state machine; animation support only. */
  protected readonly displayDialog = signal<PickupPhotoDialogState | null>(null);

  constructor() {
    effect(() => {
      const dialog = this.facade.pickupPhotoDialog();
      if (dialog) {
        this.displayDialog.set(dialog);
      }
    });
  }

  protected onFileSelected(file: File): void {
    this.facade.selectPickupPhoto(file);
  }

  protected canSubmit(): boolean {
    const dialog = this.facade.pickupPhotoDialog();
    return !!dialog?.file && !dialog.uploading;
  }

  protected submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    void this.facade.submitPickupPhoto();
  }

  protected close(): void {
    this.facade.closePickupPhotoDialog();
  }
}
