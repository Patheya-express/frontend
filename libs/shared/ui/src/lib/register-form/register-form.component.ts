import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

export interface RegisterFormValue {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

@Component({
  selector: 'lib-register-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './register-form.component.html',
  styleUrl: './register-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterFormComponent {
  @Input() loading = false;
  @Input() errorMessage: string | null = null;
  @Output() submitted = new EventEmitter<RegisterFormValue>();

  protected readonly form = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
  });

  /** `RegisterDto` has no terms-acceptance field — the backend doesn't enforce this, so it's
   *  kept entirely outside `form`/`RegisterFormValue` and never sent; it's a client-side gate
   *  only, same as any other required checkbox. */
  protected readonly termsAccepted = new FormControl(false, {
    nonNullable: true,
    validators: [Validators.requiredTrue],
  });

  protected onSubmit(): void {
    this.termsAccepted.markAsTouched();

    if (this.form.invalid || this.termsAccepted.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitted.emit(this.form.getRawValue());
  }
}
