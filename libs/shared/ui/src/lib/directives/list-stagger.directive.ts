import { Directive, input } from '@angular/core';

/**
 * Sets the `--stagger-index` custom property `keyframes.scss`'s list-entrance animation delay
 * reads (`animation-delay: calc(var(--stagger-index) * var(--motion-stagger-step))`). Small glue
 * directive backing the "List Animation" catalog entry — pass the `@for` loop index in.
 *
 * @example
 * @for (item of items(); track item.id; let i = $index) {
 *   <mobile-list-tile [mobileListStagger]="i" [class]="listItemEnterClass">
 * }
 */
@Directive({
  selector: '[mobileListStagger]',
  standalone: true,
  host: {
    '[style.--stagger-index]': 'mobileListStagger()',
  },
})
export class ListStaggerDirective {
  readonly mobileListStagger = input.required<number>();
}
