import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

export interface ForgotPasswordFormValue {
  email: string;
}

@Component({
  selector: 'lib-forgot-password-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './forgot-password-form.component.html',
  styleUrl: './forgot-password-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordFormComponent {
  @Input() loading = false;
  @Input() errorMessage: string | null = null;
  @Output() submitted = new EventEmitter<ForgotPasswordFormValue>();

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
  });

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitted.emit(this.form.getRawValue());
  }
}
