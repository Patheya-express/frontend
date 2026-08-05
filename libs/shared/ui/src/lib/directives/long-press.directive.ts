import { Directive, OnDestroy, input, output } from '@angular/core';

const DEFAULT_THRESHOLD_MS = 500;
const MOVE_TOLERANCE_PX = 10;

/**
 * Emits `longPress` after the pointer is held down for `mobileLongPressThreshold` ms, cancelling
 * if it's released or dragged more than a few px first (so it doesn't fire mid-scroll/mid-swipe).
 *
 * @example <div [mobileLongPress] (longPress)="openContextActions()">…</div>
 */
@Directive({
  selector: '[mobileLongPress]',
  standalone: true,
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '(pointerup)': 'cancel()',
    '(pointerleave)': 'cancel()',
    '(pointermove)': 'onPointerMove($event)',
  },
})
export class LongPressDirective implements OnDestroy {
  readonly mobileLongPressThreshold = input(DEFAULT_THRESHOLD_MS);
  readonly longPress = output<void>();

  private timer?: ReturnType<typeof setTimeout>;
  private origin?: { x: number; y: number };

  ngOnDestroy(): void {
    this.cancel();
  }

  onPointerDown(event: PointerEvent): void {
    this.origin = { x: event.clientX, y: event.clientY };
    this.timer = setTimeout(() => this.longPress.emit(), this.mobileLongPressThreshold());
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.origin) {
      return;
    }

    const distance = Math.hypot(event.clientX - this.origin.x, event.clientY - this.origin.y);
    if (distance > MOVE_TOLERANCE_PX) {
      this.cancel();
    }
  }

  cancel(): void {
    clearTimeout(this.timer);
    this.origin = undefined;
  }
}
