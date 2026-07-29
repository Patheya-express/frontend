import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BottomSheetComponent } from '../../bottom-sheet/bottom-sheet.component';
import { BottomSheetService } from '../../services/bottom-sheet.service';
import { MOBILE_BOTTOM_SHEET_TRANSITION } from '../../animations/bottom-sheet.animation';

/**
 * Renders every sheet opened via `BottomSheetService.open()` — mount once, near the app root
 * (`MobileShellComponent` does this automatically). Wraps each entry's content in
 * `BottomSheetComponent` (the chrome/swipe-to-dismiss primitive) and owns the backdrop + stacking
 * + Escape-to-dismiss on top of that. See `ModalHostComponent`'s doc comment for the content
 * contract (`data`/`overlayId` inputs, self-closing content).
 */
@Component({
  selector: 'lib-bottom-sheet-host',
  standalone: true,
  imports: [NgComponentOutlet, BottomSheetComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    @for (entry of bottomSheetService.entries(); track entry.id) {
      <!-- Decorative scrim, intentionally not a tab stop: Escape (see host listener above),
           swipe-down (BottomSheetComponent's own SwipeDirective), and the sheet content's own
           Cancel/Close control already give keyboard/AT/touch users a fully accessible way to
           dismiss, so this click-to-dismiss is a mouse-only convenience. -->
      <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
      <div
        class="mobile-bottom-sheet-host__backdrop {{ transition.backdropEnter }}"
        (click)="onBackdropClick(entry.id, entry.config.dismissible)"
      ></div>
      <lib-bottom-sheet
        class="mobile-bottom-sheet-host__sheet"
        [dismissible]="entry.config.dismissible !== false"
        [ariaLabel]="entry.config.ariaLabel"
        (dismissed)="bottomSheetService.close(entry.id)"
      >
        <ng-container
          [ngComponentOutlet]="entry.component"
          [ngComponentOutletInputs]="{ data: entry.config.data, overlayId: entry.id }"
        />
      </lib-bottom-sheet>
    }
  `,
  styles: `
    .mobile-bottom-sheet-host__backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--z-index-overlay-backdrop);
      background: var(--color-overlay-backdrop);
    }

    .mobile-bottom-sheet-host__sheet {
      position: fixed;
      inset-inline: 0;
      bottom: 0;
      z-index: var(--z-index-bottom-sheet);
    }
  `,
})
export class BottomSheetHostComponent {
  protected readonly bottomSheetService = inject(BottomSheetService);
  protected readonly transition = MOBILE_BOTTOM_SHEET_TRANSITION;

  onBackdropClick(id: string, dismissible: boolean | undefined): void {
    if (dismissible !== false) {
      this.bottomSheetService.close(id);
    }
  }

  onEscape(): void {
    const entries = this.bottomSheetService.entries();
    const topmost = entries[entries.length - 1];
    if (topmost && topmost.config.dismissible !== false) {
      this.bottomSheetService.close(topmost.id);
    }
  }
}
