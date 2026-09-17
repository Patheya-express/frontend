import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FileUploadComponent } from '@patheya-express-frontend/ui';
import { DeliveryAssignmentsFacade } from '../../facades/delivery-assignments.facade';

/**
 * Business requirement (delivery parcel photo + customer confirmation + OTP-gated delivery) —
 * mandatory pickup-parcel photo capture. Self-contained like ProofOtpDialogComponent (reads the
 * facade directly), since it owns the same shape of local state (a not-yet-submitted selection
 * the rider can retake before confirming — see PickupPhotoDialogState's doc comment). Reuses
 * FileUploadComponent for the actual picker; `capture="environment"` makes mobile
 * browsers/WebViews open the native camera directly with no Capacitor plugin involved.
 */
@Component({
  selector: 'lib-pickup-photo-dialog',
  standalone: true,
  imports: [FileUploadComponent],
  templateUrl: './pickup-photo-dialog.component.html',
  styleUrl: './pickup-photo-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PickupPhotoDialogComponent {
  protected readonly facade = inject(DeliveryAssignmentsFacade);

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
