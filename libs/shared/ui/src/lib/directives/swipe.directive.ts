import { Directive, output } from '@angular/core';

export type MobileSwipeDirection = 'up' | 'down' | 'left' | 'right';

export interface MobileSwipeEvent {
  direction: MobileSwipeDirection;
  distancePx: number;
  velocityPxPerMs: number;
}

const MIN_DISTANCE_PX = 40;
const MIN_VELOCITY_PX_PER_MS = 0.25;

/**
 * Emits `swiped` for a fast pointer drag exceeding both a minimum distance and velocity (so a
 * slow drag-and-release doesn't register as a swipe). Used by `BottomSheetComponent` for
 * swipe-down-to-dismiss; also usable directly on cards for swipe actions.
 *
 * @example <div (swiped)="onSwipe($event)" [mobileSwipe]>…</div>
 */
@Directive({
  selector: '[mobileSwipe]',
  standalone: true,
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'reset()',
  },
})
export class SwipeDirective {
  readonly swiped = output<MobileSwipeEvent>();

  private start?: { x: number; y: number; t: number };

  onPointerDown(event: PointerEvent): void {
    this.start = { x: event.clientX, y: event.clientY, t: event.timeStamp };
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.start) {
      return;
    }

    const dx = event.clientX - this.start.x;
    const dy = event.clientY - this.start.y;
    const dt = Math.max(event.timeStamp - this.start.t, 1);
    const isHorizontal = Math.abs(dx) > Math.abs(dy);
    const distance = isHorizontal ? Math.abs(dx) : Math.abs(dy);
    const velocity = distance / dt;

    this.reset();

    if (distance < MIN_DISTANCE_PX || velocity < MIN_VELOCITY_PX_PER_MS) {
      return;
    }

    const direction: MobileSwipeDirection = isHorizontal
      ? dx > 0
        ? 'right'
        : 'left'
      : dy > 0
        ? 'down'
        : 'up';

    this.swiped.emit({ direction, distancePx: distance, velocityPxPerMs: velocity });
  }

  reset(): void {
    this.start = undefined;
  }
}
