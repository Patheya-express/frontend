import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomerProfileFacade } from '@patheya-express-frontend/customer-profile';

const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

@Component({
  selector: 'lib-change-password-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './change-password-form.component.html',
  styleUrl: './change-password-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly facade = inject(CustomerProfileFacade);

  protected readonly saving = this.facade.passwordSaving;
  protected readonly error = this.facade.passwordError;
  protected readonly success = this.facade.passwordSuccess;

  protected readonly form = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.pattern(STRONG_PASSWORD_PATTERN)]],
    confirmPassword: ['', [Validators.required]],
  });

  protected readonly submitted = signal(false);

  protected async onSubmit(): Promise<void> {
    this.submitted.set(true);

    if (this.form.invalid || this.passwordsMismatch()) {
      return;
    }

    const { currentPassword, newPassword } = this.form.getRawValue();
    const ok = await this.facade.changePassword({ currentPassword, newPassword });

    if (ok) {
      this.form.reset();
      this.submitted.set(false);
    }
  }

  protected passwordsMismatch(): boolean {
    const { newPassword, confirmPassword } = this.form.getRawValue();
    return confirmPassword.length > 0 && newPassword !== confirmPassword;
  }
}
