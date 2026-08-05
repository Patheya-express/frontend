import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonBase } from './button-base';
import { RippleDirective } from '../directives/ripple.directive';

/**
 * High-emphasis call-to-action button (brand color fill) — one per screen/section is the usual
 * budget; use `SecondaryButtonComponent` for anything paired alongside it.
 *
 * @example
 * <lib-primary-button [loading]="isPlacingOrder()" (buttonClick)="placeOrder()">
 *   Place order
 * </lib-primary-button>
 */
@Component({
  selector: 'lib-primary-button',
  standalone: true,
  imports: [RippleDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './primary-button.component.html',
  styleUrl: './primary-button.component.scss',
})
export class PrimaryButtonComponent extends ButtonBase {}
