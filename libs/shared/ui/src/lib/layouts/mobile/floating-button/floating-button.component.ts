import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MOBILE_FAB_TRANSITION } from '../../../animations/fab.animation';

export type MobileFabPosition = 'bottom-right' | 'bottom-left' | 'bottom-center';

/**
 * Floating action button — fixed-positioned, safe-area-bottom aware, pop in/out via
 * `MOBILE_FAB_TRANSITION` when `visible` toggles (e.g. hidden while scrolling down, shown on
 * scroll up — that scroll logic is the consuming screen's, not this component's).
 *
 * @example
 * <mobile-floating-button ariaLabel="Add item" (buttonClick)="addItem()">+</mobile-floating-button>
 */
@Component({
  selector: 'mobile-floating-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()',
    '[style.display]': "visible() ? null : 'none'",
  },
  template: `
    <button
      type="button"
      class="mobile-floating-button__button"
      [attr.aria-label]="ariaLabel()"
      (click)="buttonClick.emit()"
    >
      <ng-content />
    </button>
  `,
  styles: `
    :host {
      position: fixed;
      z-index: var(--z-index-fab);
    }

    :host(.mobile-fab--bottom-right) {
      right: var(--space-4);
      bottom: calc(var(--space-4) + var(--safe-area-bottom));
    }

    :host(.mobile-fab--bottom-left) {
      left: var(--space-4);
      bottom: calc(var(--space-4) + var(--safe-area-bottom));
    }

    :host(.mobile-fab--bottom-center) {
      left: 50%;
      bottom: calc(var(--space-4) + var(--safe-area-bottom));
      transform: translateX(-50%);
    }

    .mobile-floating-button__button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: var(--touch-target-large);
      height: var(--touch-target-large);
      border: none;
      border-radius: var(--radius-full);
      background: var(--color-primary);
      color: var(--color-text-on-primary);
      font-size: var(--font-size-xl);
      box-shadow: var(--elevation-3);
      cursor: pointer;
    }
  `,
})
export class FloatingButtonComponent {
  readonly ariaLabel = input.required<string>();
  readonly position = input<MobileFabPosition>('bottom-right');
  readonly visible = input(true);
  readonly buttonClick = output<void>();

  protected readonly hostClass = computed(
    () =>
      `mobile-fab mobile-fab--${this.position()} ${this.visible() ? MOBILE_FAB_TRANSITION.enter : ''}`,
  );
}
