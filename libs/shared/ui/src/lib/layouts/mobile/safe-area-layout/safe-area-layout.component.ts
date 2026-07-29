import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Generic safe-area padding wrapper — pass only the edges that matter for this particular
 * container (a full-bleed hero image only needs `top`, a bottom sheet only needs `bottom`),
 * rather than always paying for all four via a blanket `.safe-area-inset` class.
 *
 * @example <mobile-safe-area-layout [top]="true" [bottom]="true"><router-outlet /></mobile-safe-area-layout>
 */
@Component({
  selector: 'mobile-safe-area-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.safe-area-top]': 'top()',
    '[class.safe-area-right]': 'right()',
    '[class.safe-area-bottom]': 'bottom()',
    '[class.safe-area-left]': 'left()',
  },
  template: `<ng-content />`,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class SafeAreaLayoutComponent {
  readonly top = input(false);
  readonly right = input(false);
  readonly bottom = input(false);
  readonly left = input(false);
}
