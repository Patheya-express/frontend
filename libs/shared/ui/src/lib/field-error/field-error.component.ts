import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Input,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { AbstractControl } from '@angular/forms';

/** Validator error key → message, in priority order (the first present error wins), e.g.
 *  `{ required: 'Bank name is required.', minlength: 'Enter at least 6 digits.' }`. */
export type FieldErrorMessages = Readonly<Record<string, string>>;

/**
 * Inline validation message for one reactive-form control — shown only once the control has
 * been touched (or a submit called `markAllAsTouched()`), so users never see errors before they
 * interact. Always shows the message for the *specific* failing validator rather than a generic
 * one. Give it an `id` and reference that id from the control's `aria-describedby` so screen
 * readers announce it. Styling comes from the global `.form-field-error` class (theme.scss).
 */
@Component({
  selector: 'lib-field-error',
  standalone: true,
  template: `
    @if (message(); as text) {
      <span class="form-field-error" [id]="id" role="alert">{{ text }}</span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldErrorComponent implements OnInit {
  @Input({ required: true }) control!: AbstractControl;
  @Input({ required: true }) messages!: FieldErrorMessages;
  @Input() id: string | null = null;

  private readonly destroyRef = inject(DestroyRef);
  protected readonly message = signal<string | null>(null);

  ngOnInit(): void {
    this.update();
    // `events` covers value, status, touched and submit changes — the touched-on-blur case in
    // particular emits no valueChanges/statusChanges, which is why those alone aren't enough.
    this.control.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.update());
  }

  private update(): void {
    const { control } = this;
    if (!control.touched || !control.errors) {
      this.message.set(null);
      return;
    }

    const key = Object.keys(this.messages).find((errorKey) =>
      control.hasError(errorKey),
    );
    this.message.set(key ? this.messages[key] : null);
  }
}
