import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Shared +/- quantity control — previously duplicated near-identically across
 * `CartItemComponent` and `MenuItemCardComponent` (a third copy, in the menu-item customization
 * sheet, had drifted to a slightly different size/no-hover variant; all three now render this one
 * component instead). Presentational only: it never owns the quantity value or decides how to
 * mutate it — each consumer keeps its own `increase()`/`decrease()` method (a cart-store call, a
 * local signal update, whatever it already did), this just renders the three-part control and
 * re-emits taps for the consumer to handle exactly as before.
 *
 * `disableDecrease`/`disableIncrease` default to `false` (every current consumer omits them,
 * matching their pre-migration behavior of always-tappable buttons) — they exist so a future
 * consumer that genuinely has a min/max/busy state can express it without a second component.
 *
 * @example
 * <lib-quantity-stepper [value]="item.quantity" (decreased)="decrease()" (increased)="increase()" />
 */
@Component({
  selector: 'lib-quantity-stepper',
  standalone: true,
  templateUrl: './quantity-stepper.component.html',
  styleUrl: './quantity-stepper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'quantity-stepper',
  },
})
export class QuantityStepperComponent {
  readonly value = input.required<number>();
  readonly disableDecrease = input(false);
  readonly disableIncrease = input(false);

  readonly decreased = output<void>();
  readonly increased = output<void>();
}
