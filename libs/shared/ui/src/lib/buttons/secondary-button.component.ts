import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonBase } from './button-base';
import { RippleDirective } from '../directives/ripple.directive';

/**
 * Medium-emphasis button (outlined, no fill) — paired with `PrimaryButtonComponent` for the
 * "Cancel" / "Confirm" pattern, or standalone for secondary actions.
 *
 * @example
 * <lib-secondary-button (buttonClick)="dismiss()">Not now</lib-secondary-button>
 */
@Component({
  selector: 'lib-secondary-button',
  standalone: true,
  imports: [RippleDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './secondary-button.component.html',
  styleUrl: './secondary-button.component.scss',
})
export class SecondaryButtonComponent extends ButtonBase {}
