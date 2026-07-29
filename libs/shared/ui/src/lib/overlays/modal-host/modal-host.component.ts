import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AutoFocusDirective } from '../../directives/auto-focus.directive';
import { ModalService } from '../../services/modal.service';
import { MOBILE_MODAL_TRANSITION } from '../../animations/modal.animation';

/**
 * Renders every overlay opened via `ModalService.open()` — mount once, near the app root
 * (`MobileShellComponent` does this automatically, so most apps never place this directly).
 * Content components receive `data`/`overlayId` inputs (the "overlay content contract" —
 * see `ConfirmationDialogComponent` for a worked example) and call `ModalService.close()`
 * themselves; this host only owns the backdrop, stacking, Escape-to-dismiss, and focus-on-open.
 */
@Component({
  selector: 'lib-modal-host',
  standalone: true,
  imports: [NgComponentOutlet, AutoFocusDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    @for (entry of modalService.entries(); track entry.id) {
      <!-- Decorative scrim, intentionally not a tab stop: Escape (see host listener above) and
           the modal content's own Cancel/Close control already give keyboard/AT users a fully
           accessible way to dismiss, so this click-to-dismiss is a mouse/touch-only convenience. -->
      <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
      <div
        class="mobile-modal-host__backdrop {{ transition.backdropEnter }}"
        (click)="onBackdropClick(entry.id, entry.config.dismissible)"
      ></div>
      <div
        class="mobile-modal-host__surface {{ transition.enter }}"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        [mobileAutoFocus]="true"
        [attr.aria-label]="entry.config.ariaLabel ?? null"
      >
        <ng-container
          [ngComponentOutlet]="entry.component"
          [ngComponentOutletInputs]="{ data: entry.config.data, overlayId: entry.id }"
        />
      </div>
    }
  `,
  styles: `
    .mobile-modal-host__backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--z-index-overlay-backdrop);
      background: var(--color-overlay-backdrop);
    }

    .mobile-modal-host__surface {
      position: fixed;
      inset: var(--space-6) var(--space-4);
      z-index: var(--z-index-modal);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      border-radius: var(--radius-lg);
      background: var(--color-elevated-surface, var(--color-surface));
      box-shadow: var(--elevation-5);
    }
  `,
})
export class ModalHostComponent {
  protected readonly modalService = inject(ModalService);
  protected readonly transition = MOBILE_MODAL_TRANSITION;

  onBackdropClick(id: string, dismissible: boolean | undefined): void {
    if (dismissible !== false) {
      this.modalService.close(id);
    }
  }

  onEscape(): void {
    const entries = this.modalService.entries();
    const topmost = entries[entries.length - 1];
    if (topmost && topmost.config.dismissible !== false) {
      this.modalService.close(topmost.id);
    }
  }
}
