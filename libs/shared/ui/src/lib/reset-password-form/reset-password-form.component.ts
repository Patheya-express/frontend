import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { PrimaryButtonComponent } from '../buttons/primary-button.component';
import { focusFirstInvalidControl } from '../utils/form-focus.utils';

export interface ResetPasswordFormValue {
  newPassword: string;
}

function passwordsMatchValidator(
  group: AbstractControl,
): ValidationErrors | null {
  const password = group.get('newPassword')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;

  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'lib-reset-password-form',
  standalone: true,
  imports: [ReactiveFormsModule, PrimaryButtonComponent],
  templateUrl: './reset-password-form.component.html',
  styleUrl: './reset-password-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordFormComponent {
  @Input() loading = false;
  @Input() errorMessage: string | null = null;
  @Output() submitted = new EventEmitter<ResetPasswordFormValue>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly form = new FormGroup(
    {
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: passwordsMatchValidator },
  );

  /** "Required" when empty, "mismatch" only once something was typed — never both at once. */
  protected confirmError(): string | null {
    const confirm = this.form.controls.confirmPassword;
    if (!confirm.touched) {
      return null;
    }
    if (confirm.hasError('required')) {
      return 'Confirm your new password.';
    }
    return this.form.hasError('passwordMismatch')
      ? 'Passwords do not match.'
      : null;
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.host.nativeElement);
      return;
    }

    this.submitted.emit({ newPassword: this.form.controls.newPassword.value });
  }
}
