import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ForgotPasswordFormComponent } from '../forgot-password-form/forgot-password-form.component';
import { ResetPasswordFormComponent } from './reset-password-form.component';

function type(
  fixture: ComponentFixture<unknown>,
  id: string,
  value: string,
): void {
  const input = (fixture.nativeElement as HTMLElement).querySelector(
    `#${id}`,
  ) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
  fixture.detectChanges();
}

function text(fixture: ComponentFixture<unknown>, id: string): string | null {
  return (
    (fixture.nativeElement as HTMLElement)
      .querySelector(`#${id}`)
      ?.textContent?.trim() ?? null
  );
}

function submit(fixture: ComponentFixture<unknown>): void {
  (fixture.nativeElement as HTMLElement)
    .querySelector('form')
    ?.dispatchEvent(new Event('submit'));
  fixture.detectChanges();
}

describe('ResetPasswordFormComponent', () => {
  let fixture: ComponentFixture<ResetPasswordFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ResetPasswordFormComponent] });
    fixture = TestBed.createComponent(ResetPasswordFormComponent);
    fixture.detectChanges();
  });

  it('states the password requirement up front and marks both fields required', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(
      root.querySelector('#reset-password-new-hint')?.textContent,
    ).toContain('at least 8 characters');
    expect(
      (root.querySelector('#reset-password-new') as HTMLInputElement).required,
    ).toBe(true);
    expect(
      (root.querySelector('#reset-password-confirm') as HTMLInputElement)
        .required,
    ).toBe(true);
  });

  it('says "required" for empty fields — not a length or mismatch error — and emits nothing', () => {
    const emitted = jest.fn();
    fixture.componentInstance.submitted.subscribe(emitted);

    submit(fixture);

    expect(text(fixture, 'reset-password-new-error')).toBe(
      'New password is required.',
    );
    expect(text(fixture, 'reset-password-confirm-error')).toBe(
      'Confirm your new password.',
    );
    expect(emitted).not.toHaveBeenCalled();
  });

  it('reports a mismatch only once a confirmation was typed', () => {
    type(fixture, 'reset-password-new', 'correct-horse');
    type(fixture, 'reset-password-confirm', 'correct-horsf');

    expect(text(fixture, 'reset-password-confirm-error')).toBe(
      'Passwords do not match.',
    );
  });

  it('emits the new password when valid', () => {
    const emitted = jest.fn();
    fixture.componentInstance.submitted.subscribe(emitted);
    type(fixture, 'reset-password-new', 'correct-horse');
    type(fixture, 'reset-password-confirm', 'correct-horse');

    submit(fixture);

    expect(emitted).toHaveBeenCalledWith({ newPassword: 'correct-horse' });
  });
});

describe('ForgotPasswordFormComponent', () => {
  it('distinguishes a missing email from a malformed one', () => {
    TestBed.configureTestingModule({ imports: [ForgotPasswordFormComponent] });
    const fixture = TestBed.createComponent(ForgotPasswordFormComponent);
    fixture.detectChanges();

    submit(fixture);
    expect(text(fixture, 'forgot-password-email-error')).toBe(
      'Email is required.',
    );

    type(fixture, 'forgot-password-email', 'not-an-email');
    expect(text(fixture, 'forgot-password-email-error')).toBe(
      'Enter a valid email address.',
    );
  });
});
