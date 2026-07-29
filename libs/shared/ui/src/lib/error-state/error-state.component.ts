import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'lib-error-state',
  standalone: true,
  templateUrl: './error-state.component.html',
  styleUrl: './error-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorStateComponent {
  @Input() title = 'Something went wrong';
  @Input() message = 'Please try again.';
  @Input() retryLabel = 'Try again';
  /** Set false when projecting a custom icon into the `libIcon` slot, to suppress the default
   *  illustration instead of showing both. Defaults true so every existing usage (none of which
   *  project anything) keeps rendering the built-in illustration exactly as before. */
  @Input() showDefaultIllustration = true;
  @Output() retry = new EventEmitter<void>();
}
