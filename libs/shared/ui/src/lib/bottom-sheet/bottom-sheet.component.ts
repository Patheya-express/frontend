import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AutoFocusDirective } from '../directives/auto-focus.directive';
import { FocusTrapDirective } from '../directives/focus-trap.directive';
import { SwipeDirective, type MobileSwipeEvent } from '../directives/swipe.directive';

/**
 * Bottom-anchored sheet chrome: rounded top corners, optional drag handle, safe-area-aware
 * bottom padding, swipe-down-to-dismiss. Purely presentational — `BottomSheetHostComponent` is
 * what actually opens one via `BottomSheetService`; this component only renders the chrome
 * around whatever content it's given, so it's also usable standalone for a sheet that isn't
 * going through the overlay stack (e.g. a permanently-mounted sheet in a custom layout).
 *
 * Default (unnamed) projected content scrolls internally. The two named slots below are optional
 * — sheets that don't need a non-scrolling header/footer (the common case) can ignore them
 * entirely and project everything into the default slot, exactly as before this pair was added.
 *
 * @example
 * <lib-bottom-sheet (dismissed)="close()">
 *   <header sheetHeader>Title</header>
 *   <p>Scrollable sheet content</p>
 *   <footer sheetFooter>Actions</footer>
 * </lib-bottom-sheet>
 */
@Component({
  selector: 'lib-bottom-sheet',
  standalone: true,
  imports: [SwipeDirective, AutoFocusDirective, FocusTrapDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'dialog',
    'aria-modal': 'true',
    '[attr.aria-label]': 'ariaLabel() ?? null',
    class: 'mobile-bottom-sheet-host mobile-anim-sheet-enter',
  },
  template: `
    <div
      class="mobile-bottom-sheet__surface safe-area-bottom"
      mobileSwipe
      (swiped)="onSwipe($event)"
      tabindex="-1"
      [mobileAutoFocus]="true"
      libFocusTrap
    >
      @if (showHandle()) {
        <div class="mobile-bottom-sheet__handle" aria-hidden="true"></div>
      }
      <ng-content select="[sheetHeader]" />
      <div class="mobile-bottom-sheet__content">
        <ng-content />
      </div>
      <ng-content select="[sheetFooter]" />
    </div>
  `,
  styles: `
    .mobile-bottom-sheet-host {
      display: block;
    }

    .mobile-bottom-sheet__surface {
      display: flex;
      flex-direction: column;
      max-height: 88vh;
      background: var(--color-elevated-surface, var(--color-surface));
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      box-shadow: var(--elevation-4);
      touch-action: pan-y;
    }

    .mobile-bottom-sheet__handle {
      width: 36px;
      height: 4px;
      margin: var(--space-2) auto;
      border-radius: var(--radius-full);
      background: var(--color-border);
      flex-shrink: 0;
    }

    .mobile-bottom-sheet__content {
      overflow-y: auto;
      padding: 0 var(--space-4) var(--space-4);
    }
  `,
})
export class BottomSheetComponent {
  readonly dismissible = input(true);
  readonly showHandle = input(true);
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly dismissed = output<void>();

  onSwipe(event: MobileSwipeEvent): void {
    if (this.dismissible() && event.direction === 'down') {
      this.dismissed.emit();
    }
  }
}
