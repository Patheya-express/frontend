import { Directive, ElementRef, inject, input, output } from '@angular/core';

/**
 * Emits `reachedEnd` once the host's scroll position comes within `thresholdPx` of the bottom —
 * fire early enough (default 240px) that the next page's request has time to land before the
 * user actually hits the bottom. Scroll handling is rAF-throttled to stay off the main thread's
 * critical path during a fling.
 *
 * @example <mobile-scrollable-page [mobileInfiniteScroll] (reachedEnd)="loadMore()">
 */
@Directive({
  selector: '[mobileInfiniteScroll]',
  standalone: true,
  host: {
    '(scroll)': 'onScroll()',
  },
})
export class InfiniteScrollDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly thresholdPx = input(240);
  readonly reachedEnd = output<void>();

  private ticking = false;

  onScroll(): void {
    if (this.ticking) {
      return;
    }

    this.ticking = true;

    requestAnimationFrame(() => {
      this.ticking = false;
      const el = this.elementRef.nativeElement;
      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

      if (distanceToBottom <= this.thresholdPx()) {
        this.reachedEnd.emit();
      }
    });
  }
}
