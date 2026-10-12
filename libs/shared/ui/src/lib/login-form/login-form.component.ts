import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  inject,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { PrimaryButtonComponent } from '../buttons/primary-button.component';
import { focusFirstInvalidControl } from '../utils/form-focus.utils';

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
  imports: [ReactiveFormsModule, PrimaryButtonComponent],
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

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
    rememberMe: new FormControl(true, { nonNullable: true }),
  });

  ngOnChanges(): void {
    if (this.initialEmail && !this.form.controls.email.dirty) {
      this.form.controls.email.setValue(this.initialEmail);
      this.form.controls.rememberMe.setValue(true);
    }
  }

  /** Errors appear once a field has been visited (or on a submit attempt), never on first render. */
  protected showError(control: 'email' | 'password'): boolean {
    const field = this.form.controls[control];
    return field.invalid && field.touched;
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.host.nativeElement);
      return;
    }

    this.submitted.emit(this.form.getRawValue());
  }
}
