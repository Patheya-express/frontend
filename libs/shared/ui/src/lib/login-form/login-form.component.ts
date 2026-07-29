import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

export interface LoginFormValue {
  email: string;
  password: string;
  /** UI-only convenience — `LoginDto` has no such field; the caller is responsible for not
   *  forwarding this to `AuthFacade.login()`, only using it for local "remember my email"
   *  behavior (see `LoginPageComponent`). */
  rememberMe: boolean;
}

@Component({
  selector: 'lib-login-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginFormComponent implements OnChanges {
  @Input() loading = false;
  @Input() errorMessage: string | null = null;
  /** Pre-fills the email field (e.g. from a previously-remembered login) without marking it
   *  touched/dirty — set once, typically from the page's `ngOnInit`-time read of local storage. */
  @Input() initialEmail = '';
  @Output() submitted = new EventEmitter<LoginFormValue>();

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
    rememberMe: new FormControl(true, { nonNullable: true }),
  });

  ngOnChanges(): void {
    if (this.initialEmail && !this.form.controls.email.dirty) {
      this.form.controls.email.setValue(this.initialEmail);
      this.form.controls.rememberMe.setValue(true);
    }
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitted.emit(this.form.getRawValue());
  }
}
