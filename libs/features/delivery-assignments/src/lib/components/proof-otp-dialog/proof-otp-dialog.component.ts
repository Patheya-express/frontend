import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { DeliveryAssignmentsFacade } from '../../facades/delivery-assignments.facade';

/**
 * Delivery Proof & Trust (Sprint 4.1). Self-contained (reads the facade directly, unlike the
 * fully-dumb ConfirmDialogComponent) because it owns meaningfully more local state — the code
 * input and per-dialog reset behavior — than a handful of inputs/outputs could express cleanly.
 */
@Component({
  selector: 'lib-proof-otp-dialog',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './proof-otp-dialog.component.html',
  styleUrl: './proof-otp-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProofOtpDialogComponent {
  protected readonly facade = inject(DeliveryAssignmentsFacade);

  protected readonly code = signal('');

  private lastDialogKey: string | null = null;

  constructor() {
    // Resets the code input whenever a different dialog opens (or the current one closes) —
    // but not on every otpDialog() change, since attemptsRemaining/error updates within the
    // same dialog shouldn't wipe out what the partner already typed.
    effect(() => {
      const dialog = this.facade.otpDialog();
      const key = dialog ? `${dialog.assignmentId}:${dialog.type}` : null;
      if (key !== this.lastDialogKey) {
        this.lastDialogKey = key;
        this.code.set('');
      }
    });
  }

  protected get title(): string {
    return this.facade.otpDialog()?.type === 'pickup' ? 'Verify pickup' : 'Verify delivery';
  }

  protected get helpText(): string {
    return this.facade.otpDialog()?.type === 'pickup'
      ? 'Ask the customer for the pickup code and enter it below.'
      : 'Ask the customer for the delivery code and enter it below.';
  }

  protected onCodeInput(value: string): void {
    this.code.set(value.replace(/\D/g, '').slice(0, 6));
  }

  protected canSubmit(): boolean {
    const dialog = this.facade.otpDialog();
    return this.code().length === 6 && !!dialog && !dialog.verifying && !dialog.generating;
  }

  protected submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    void this.facade.verifyOtp(this.code());
  }

  protected regenerate(): void {
    void this.facade.regenerateOtp();
  }

  protected close(): void {
    this.facade.closeOtpDialog();
  }
}
