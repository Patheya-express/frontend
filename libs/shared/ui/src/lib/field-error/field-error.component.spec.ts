import { TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { FieldErrorComponent } from './field-error.component';

describe('FieldErrorComponent', () => {
  function render(control: FormControl<string>) {
    TestBed.configureTestingModule({ imports: [FieldErrorComponent] });
    const fixture = TestBed.createComponent(FieldErrorComponent);
    fixture.componentRef.setInput('control', control);
    fixture.componentRef.setInput('messages', {
      required: 'Bank name is required.',
      minlength: 'Enter at least 6 characters.',
    });
    fixture.componentRef.setInput('id', 'bank-name-error');
    fixture.detectChanges();
    return fixture;
  }

  function text(element: HTMLElement): string | null {
    return (
      element.querySelector('.form-field-error')?.textContent?.trim() ?? null
    );
  }

  it('shows nothing before the control is touched', () => {
    const control = new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    });
    const fixture = render(control);

    expect(text(fixture.nativeElement)).toBeNull();
  });

  it('shows the message for the specific failing validator once touched', () => {
    const control = new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    });
    const fixture = render(control);

    control.markAsTouched();
    fixture.detectChanges();
    expect(text(fixture.nativeElement)).toBe('Bank name is required.');

    control.setValue('abc');
    fixture.detectChanges();
    expect(text(fixture.nativeElement)).toBe('Enter at least 6 characters.');

    const element = fixture.nativeElement.querySelector(
      '.form-field-error',
    ) as HTMLElement;
    expect(element.id).toBe('bank-name-error');
  });

  it('clears the message when the value becomes valid', () => {
    const control = new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    });
    const fixture = render(control);
    control.markAsTouched();
    fixture.detectChanges();

    control.setValue('HDFC Bank');
    fixture.detectChanges();

    expect(text(fixture.nativeElement)).toBeNull();
  });
});
