import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, effect, input, signal } from '@angular/core';
import { AutoFocusDirective } from '../directives/auto-focus.directive';
import { FocusTrapDirective } from '../directives/focus-trap.directive';
import { MOBILE_MODAL_TRANSITION } from '../animations/modal.animation';
import { MOBILE_MOTION_DURATIONS_MS } from '../tokens/motion.tokens';

@Component({
  selector: 'lib-confirm-dialog',
  standalone: true,
  imports: [AutoFocusDirective, FocusTrapDirective],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class ConfirmDialogComponent {
  // Signal input, not a plain @Input() — the leave-animation effect() below needs to react to
  // this reactively, which only signal reads support; `[open]="expr"` template binding syntax at
  // every existing call site is completely unaffected by this (still the same property binding).
  readonly open = input(false);
  @Input() title = 'Are you sure?';
  /** Plain text only, rendered as-is (no HTML) — every existing call site passes a string.
   *  A consumer that genuinely needs richer body content (e.g. a file-upload widget, an OTP
   *  input) projects it into the `[dialogContent]` slot instead, rendered between this message
   *  and the action row; `message` and the slot can be used independently or together. */
  @Input() message?: string;
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  /** Disables both actions while a confirmed action is still in flight, to prevent duplicate submissions. */
  @Input() busy = false;
  /** Disables only the confirm action, independent of `busy` — for a consumer whose confirm step
   *  has its own precondition (e.g. "no file selected yet") that cancel is unaffected by. Defaults
   *  to `false`, matching every existing call site's current behavior (confirm follows `busy` only). */
  @Input() confirmDisabled = false;
  @Input() tone: 'default' | 'danger' = 'default';

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  protected readonly transition = MOBILE_MODAL_TRANSITION;

  /**
   * `open` flipping to `false` should still let the scale+fade leave animation play before the
   * dialog actually leaves the DOM — a plain `@if (open)` would remove it instantly, since Angular
   * template control flow (deliberately not `@angular/animations` here — see keyframes.scss's own
   * doc comment) has no built-in "wait for the leave animation" behavior the way
   * `animate.leave`/component animation triggers do. `visible` is the actual `@if` gate; it lags
   * one animation-duration behind `open` on the way out, immediate on the way in. This only changes
   * *internal* rendering timing — `open`'s contract for the ~60 existing call sites (synchronous
   * show/hide) is untouched, and confirmed/cancelled still fire exactly when clicked, not delayed.
   */
  protected readonly visible = signal(false);
  private hideTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      if (this.open()) {
        clearTimeout(this.hideTimeout);
        this.visible.set(true);
        return;
      }

      if (!this.visible()) {
        return;
      }

      this.hideTimeout = setTimeout(() => this.visible.set(false), MOBILE_MOTION_DURATIONS_MS.fast);
    });
  }

  protected onCancel(): void {
    if (this.busy) {
      return;
    }
    this.cancelled.emit();
  }

  protected onEscape(): void {
    if (!this.open() || this.busy) {
      return;
    }
    this.cancelled.emit();
  }

  protected onConfirm(): void {
    if (this.busy || this.confirmDisabled) {
      return;
    }
    this.confirmed.emit();
  }
}
