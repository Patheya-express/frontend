import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { DeliveryBankAccountResponseDto } from '@patheya-express-frontend/api-sdk';
import { DeliveryBankAccountFacade } from '../../facades/delivery-bank-account.facade';
import { BankAccountPageComponent } from './bank-account-page.component';

/**
 * Bank & payout form — required markers, field-specific messages, the account-number re-entry
 * rule (the backend always requires the full number; only the last 4 digits are ever returned)
 * and that nothing invalid or untrimmed is submitted.
 */
describe('BankAccountPageComponent', () => {
  let fixture: ComponentFixture<BankAccountPageComponent>;
  let root: HTMLElement;
  let facade: {
    bankAccount: ReturnType<
      typeof signal<DeliveryBankAccountResponseDto | null>
    >;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    saving: ReturnType<typeof signal<boolean>>;
    saveError: ReturnType<typeof signal<string | null>>;
    saveSuccessMessage: ReturnType<typeof signal<string | null>>;
    initialize: jest.Mock;
    refresh: jest.Mock;
    upsert: jest.Mock;
  };

  function render(account: DeliveryBankAccountResponseDto | null = null): void {
    facade = {
      bankAccount: signal(account),
      loading: signal(false),
      error: signal<string | null>(null),
      saving: signal(false),
      saveError: signal<string | null>(null),
      saveSuccessMessage: signal<string | null>(null),
      initialize: jest.fn(),
      refresh: jest.fn(),
      upsert: jest.fn().mockResolvedValue(true),
    };
    TestBed.configureTestingModule({
      imports: [BankAccountPageComponent],
      providers: [{ provide: DeliveryBankAccountFacade, useValue: facade }],
    });
    fixture = TestBed.createComponent(BankAccountPageComponent);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  function input(name: string): HTMLInputElement {
    return root.querySelector(
      `[formControlName="${name}"]`,
    ) as HTMLInputElement;
  }

  function type(name: string, value: string): void {
    const field = input(name);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function submit(): void {
    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function errorText(id: string): string | null {
    return root.querySelector(`#${id}`)?.textContent?.trim() ?? null;
  }

  it('marks the four required fields and explains the legend; branch and UPI stay optional', () => {
    render();

    expect(root.querySelector('.form-required-legend')?.textContent).toContain(
      'Required',
    );
    for (const name of [
      'accountHolderName',
      'accountNumber',
      'bankName',
      'ifsc',
    ]) {
      expect(input(name).required).toBe(true);
      expect(input(name).placeholder).not.toBe('');
    }
    for (const name of ['branchName', 'upiId']) {
      expect(input(name).required).toBe(false);
    }
    expect(root.textContent).toContain('Branch name (optional)');
    expect(root.textContent).toContain('UPI ID (optional)');
  });

  it('shows field-specific messages and submits nothing when the form is empty', () => {
    render();

    submit();

    expect(errorText('bank-holder-error')).toBe(
      'Account holder name is required.',
    );
    expect(errorText('bank-number-error')).toBe('Account number is required.');
    expect(errorText('bank-name-error')).toBe('Bank name is required.');
    expect(errorText('bank-ifsc-error')).toBe('IFSC code is required.');
    expect(facade.upsert).not.toHaveBeenCalled();
  });

  it('treats a whitespace-only holder name as missing (backend rejects it too)', () => {
    render();

    type('accountHolderName', '   ');

    expect(errorText('bank-holder-error')).toBe(
      'Account holder name is required.',
    );
  });

  it('explains short account numbers and malformed IFSC codes specifically', () => {
    render();

    type('accountNumber', '12345');
    type('ifsc', 'HDFC123');

    expect(errorText('bank-number-error')).toBe(
      'Account number must be at least 6 characters.',
    );
    expect(errorText('bank-ifsc-error')).toBe(
      'Enter a valid 11-character IFSC code.',
    );
  });

  it('asks for the full number again when an account is already saved (never pre-filled)', () => {
    render({
      accountHolderName: 'Hari Haran',
      bankName: 'HDFC Bank',
      ifsc: 'HDFC0000042',
      accountNumberLast4: '6023',
      verificationStatus: 'PENDING',
    } as DeliveryBankAccountResponseDto);

    expect(input('accountNumber').value).toBe('');
    expect(root.textContent).toContain('••••6023');
    expect(root.querySelector('#bank-number-hint')?.textContent).toContain(
      're-enter the full number',
    );
  });

  it('submits trimmed values, upper-cased IFSC, and omits empty optional fields', () => {
    render();

    type('accountHolderName', '  Hari Haran ');
    type('accountNumber', ' 50100601556023 ');
    type('bankName', ' HDFC Bank ');
    type('ifsc', 'hdfc0000042');
    submit();

    expect(facade.upsert).toHaveBeenCalledWith({
      accountHolderName: 'Hari Haran',
      accountNumber: '50100601556023',
      bankName: 'HDFC Bank',
      branchName: undefined,
      ifsc: 'HDFC0000042',
      upiId: undefined,
    });
  });

  it('shows the save confirmation and backend errors', () => {
    render();

    facade.saveSuccessMessage.set('Bank account saved.');
    fixture.detectChanges();
    expect(root.querySelector('[role="status"]')?.textContent).toContain(
      'Bank account saved.',
    );

    facade.saveError.set('ifsc must be a valid IFSC code');
    fixture.detectChanges();
    expect(root.querySelector('.bank-account-error')?.textContent).toContain(
      'ifsc must be a valid IFSC code',
    );
  });
});
