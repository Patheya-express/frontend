import { ChangeDetectionStrategy, Component, OnInit, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ErrorStateComponent, SkeletonComponent, StatusChipComponent, type StatusChipTone } from '@patheya-express-frontend/ui';
import type { DeliveryBankAccountResponseDto } from '@patheya-express-frontend/api-sdk';
import { DeliveryBankAccountFacade } from '../../facades/delivery-bank-account.facade';

function verificationTone(status: DeliveryBankAccountResponseDto['verificationStatus']): StatusChipTone {
  switch (status) {
    case 'VERIFIED':
      return 'success';
    case 'REJECTED':
    case 'EXPIRED':
      return 'error';
    case 'UNDER_REVIEW':
      return 'info';
    default:
      return 'neutral';
  }
}

@Component({
  selector: 'lib-bank-account-page',
  standalone: true,
  imports: [ReactiveFormsModule, SkeletonComponent, ErrorStateComponent, StatusChipComponent],
  templateUrl: './bank-account-page.component.html',
  styleUrl: './bank-account-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankAccountPageComponent implements OnInit {
  protected readonly facade = inject(DeliveryBankAccountFacade);
  private readonly fb = inject(FormBuilder);

  protected readonly verificationTone = verificationTone;

  protected readonly bankForm = this.fb.nonNullable.group({
    accountHolderName: ['', Validators.required],
    accountNumber: ['', [Validators.required, Validators.minLength(6)]],
    bankName: ['', Validators.required],
    branchName: [''],
    ifsc: ['', [Validators.required, Validators.pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)]],
    upiId: [''],
  });

  private patched = false;

  constructor() {
    effect(() => {
      const account = this.facade.bankAccount();
      if (!account || this.patched) {
        return;
      }
      this.patched = true;
      this.bankForm.reset({
        accountHolderName: account.accountHolderName,
        accountNumber: '',
        bankName: account.bankName,
        branchName: account.branchName ?? '',
        ifsc: account.ifsc,
        upiId: account.upiId ?? '',
      });
    });
  }

  ngOnInit(): void {
    this.facade.initialize();
  }

  protected retry(): void {
    this.facade.refresh();
  }

  /** IFSC codes are always uppercase — normalizing as the partner types avoids a confusing
   *  pattern-validation failure caused only by casing. */
  protected onIfscInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.bankForm.controls.ifsc.setValue(input.value.toUpperCase());
  }

  protected onSubmit(): void {
    if (this.bankForm.invalid) {
      this.bankForm.markAllAsTouched();
      return;
    }

    const value = this.bankForm.getRawValue();

    void this.facade.upsert({
      accountHolderName: value.accountHolderName,
      accountNumber: value.accountNumber,
      bankName: value.bankName,
      branchName: value.branchName || undefined,
      ifsc: value.ifsc.toUpperCase(),
      upiId: value.upiId || undefined,
    });
  }
}
