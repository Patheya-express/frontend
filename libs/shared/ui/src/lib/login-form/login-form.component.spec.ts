import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { LoginFormComponent } from './login-form.component';

describe('LoginFormComponent — required fields and validation messages', () => {
  let fixture: ComponentFixture<LoginFormComponent>;
  let root: HTMLElement;

  function input(id: string): HTMLInputElement {
    return root.querySelector(`#${id}`) as HTMLInputElement;
  }

  function type(id: string, value: string): void {
    const field = input(id);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  }

  function submit(): void {
    root.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LoginFormComponent] });
    fixture = TestBed.createComponent(LoginFormComponent);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('marks both fields as required with a legend and gives each a placeholder', () => {
    expect(root.querySelector('.form-required-legend')?.textContent).toContain(
      'Required',
    );
    expect(input('login-email').required).toBe(true);
    expect(input('login-password').required).toBe(true);
    expect(input('login-email').placeholder).toBe('Enter your email address');
    expect(input('login-password').placeholder).toBe('Enter your password');
  });

  it('shows no errors before the user interacts', () => {
    expect(root.querySelectorAll('.form-field-error')).toHaveLength(0);
  });

  it('says a field is required (not a format/length error) when submitted empty, and emits nothing', () => {
    const emitted = jest.fn();
    fixture.componentInstance.submitted.subscribe(emitted);

    submit();

    expect(root.querySelector('#login-email-error')?.textContent).toContain(
      'Email is required.',
    );
    expect(root.querySelector('#login-password-error')?.textContent).toContain(
      'Password is required.',
    );
    expect(input('login-email').getAttribute('aria-invalid')).toBe('true');
    expect(emitted).not.toHaveBeenCalled();
  });

  it('shows the specific format and length messages for invalid values', () => {
    type('login-email', 'not-an-email');
    type('login-password', 'short');

    expect(root.querySelector('#login-email-error')?.textContent).toContain(
      'Enter a valid email address.',
    );
    expect(root.querySelector('#login-password-error')?.textContent).toContain(
      'Password must be at least 8 characters.',
    );
  });

  it('moves focus to the first invalid field on a failed submit', () => {
    type('login-email', 'partner@example.com');

    submit();

    expect(document.activeElement).toBe(input('login-password'));
  });

  it('emits the values when the form is valid', () => {
    const emitted = jest.fn();
    fixture.componentInstance.submitted.subscribe(emitted);
    type('login-email', 'partner@example.com');
    type('login-password', 'correct-horse');

    submit();

    expect(emitted).toHaveBeenCalledWith({
      email: 'partner@example.com',
      password: 'correct-horse',
      rememberMe: true,
    });
  });
});
