import { Directive, ElementRef, inject, input, output, signal } from '@angular/core';

export type MobilePullToRefreshState = 'idle' | 'pulling' | 'ready' | 'refreshing';

const TRIGGER_DISTANCE_PX = 72;
const MAX_PULL_PX = 120;

/**
 * Native-feeling pull-to-refresh: tracks a downward touch drag starting from `scrollTop === 0`,
 * exposes `pullState`/`pullDistance` signals so a host template can render its own indicator
 * (`ScrollablePageComponent` does this internally), and emits `refresh` once the drag passes
 * `TRIGGER_DISTANCE_PX` and is released. The caller must call `complete()` when its refresh work
 * settles — the directive has no way to know when an arbitrary async operation finishes.
 *
 * @example
 * <div mobilePullToRefresh #ptr="mobilePullToRefresh" (refresh)="onRefresh(ptr)">
 */
@Directive({
  selector: '[mobilePullToRefresh]',
  standalone: true,
  exportAs: 'mobilePullToRefresh',
  host: {
    '(touchstart)': 'onTouchStart($event)',
    '(touchmove)': 'onTouchMove($event)',
    '(touchend)': 'onTouchEnd()',
  },
})
export class PullToRefreshDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly disabled = input(false);
  readonly refresh = output<void>();

  private readonly pullStateSignal = signal<MobilePullToRefreshState>('idle');
  private readonly pullDistanceSignal = signal(0);

  readonly pullState = this.pullStateSignal.asReadonly();
  readonly pullDistance = this.pullDistanceSignal.asReadonly();

  private startY?: number;

  onTouchStart(event: TouchEvent): void {
    if (this.disabled() || this.elementRef.nativeElement.scrollTop > 0) {
      this.startY = undefined;
      return;
    }

    this.startY = event.touches[0]?.clientY;
  }

  onTouchMove(event: TouchEvent): void {
    if (this.startY === undefined || this.pullStateSignal() === 'refreshing') {
      return;
    }

    const currentY = event.touches[0]?.clientY ?? this.startY;
    const delta = Math.max(0, Math.min(currentY - this.startY, MAX_PULL_PX));

    if (delta <= 0) {
      this.pullStateSignal.set('idle');
      this.pullDistanceSignal.set(0);
      return;
    }

    this.pullDistanceSignal.set(delta);
    this.pullStateSignal.set(delta >= TRIGGER_DISTANCE_PX ? 'ready' : 'pulling');
  }

  onTouchEnd(): void {
    if (this.pullStateSignal() === 'ready') {
      this.pullStateSignal.set('refreshing');
      this.pullDistanceSignal.set(TRIGGER_DISTANCE_PX);
      this.refresh.emit();
    } else {
      this.pullStateSignal.set('idle');
      this.pullDistanceSignal.set(0);
    }

    this.startY = undefined;
  }

  /** Call once the caller's refresh work settles (success or failure) to reset the indicator. */
  complete(): void {
    this.pullStateSignal.set('idle');
    this.pullDistanceSignal.set(0);
  }
}
