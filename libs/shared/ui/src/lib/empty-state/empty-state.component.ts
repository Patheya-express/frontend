import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'lib-empty-state',
  standalone: true,
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  @Input() title = 'Nothing here yet';
  @Input() message?: string;
  @Input() actionLabel = 'Refresh';
  /** Set false when projecting a custom icon into the `libIcon` slot, to suppress the default
   *  illustration instead of showing both. Defaults true so every existing usage (none of which
   *  project anything) keeps rendering the built-in illustration exactly as before. */
  @Input() showDefaultIllustration = true;
  @Output() refresh = new EventEmitter<void>();
}
