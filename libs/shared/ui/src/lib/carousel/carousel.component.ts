import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { prefersReducedMotion } from '../animations/reduced-motion.util';

/**
 * Generic auto-scrolling carousel shell — campaign banners, promo cards, anything that wants
 * scroll-snap paging + indicator dots + hands-off auto-advance. Content-agnostic: it renders no
 * slide content itself, so it never needs to know what a "banner" or "offer" is — every direct
 * child of the projected content automatically becomes one full-width, snap-aligned slide (styled
 * via a `.carousel-track > *` child selector, since Angular's view encapsulation means a class
 * name here couldn't reach into the caller's own template anyway — no class to remember on the
 * caller's side). Auto-scroll stops permanently the moment the user touches/drags the track (a
 * WCAG 2.2.2-friendly "provide a way to stop movement" — any manual interaction counts), and
 * never starts at all when `prefers-reduced-motion` is set.
 *
 * @example
 * <lib-carousel [slideCount]="banners().length" ariaLabel="Promotions">
 *   @for (banner of banners(); track banner.id) {
 *     <a [routerLink]="['/offers', banner.id]">…</a>
 *   }
 * </lib-carousel>
 */
@Component({
  selector: 'lib-carousel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-carousel',
  },
  templateUrl: './carousel.component.html',
  styleUrl: './carousel.component.scss',
})
export class CarouselComponent implements OnDestroy {
  readonly slideCount = input.required<number>();
  readonly autoScroll = input(true);
  readonly intervalMs = input(5000);
  readonly ariaLabel = input('Carousel');

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  private readonly activeIndexSignal = signal(0);
  protected readonly activeIndex = this.activeIndexSignal.asReadonly();
  protected readonly indicators = computed(() =>
    Array.from({ length: this.slideCount() }, (_, index) => index),
  );

  private timer?: ReturnType<typeof setInterval>;
  private scrollTicking = false;

  constructor() {
    effect((onCleanup) => {
      if (this.autoScroll() && this.slideCount() > 1 && !prefersReducedMotion()) {
        this.startAutoScroll();
      } else {
        this.stopAutoScroll();
      }

      onCleanup(() => this.stopAutoScroll());
    });
  }

  ngOnDestroy(): void {
    this.stopAutoScroll();
  }

  protected onScroll(): void {
    if (this.scrollTicking) {
      return;
    }

    this.scrollTicking = true;
    requestAnimationFrame(() => {
      this.scrollTicking = false;
      const el = this.track().nativeElement;
      const index = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
      this.activeIndexSignal.set(Math.min(Math.max(index, 0), this.slideCount() - 1));
    });
  }

  protected onInteractionStart(): void {
    this.stopAutoScroll();
  }

  protected goTo(index: number): void {
    const el = this.track().nativeElement;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
    this.activeIndexSignal.set(index);
  }

  protected next(): void {
    this.onInteractionStart();
    this.goTo((this.activeIndexSignal() + 1) % this.slideCount());
  }

  protected previous(): void {
    this.onInteractionStart();
    this.goTo((this.activeIndexSignal() - 1 + this.slideCount()) % this.slideCount());
  }

  private startAutoScroll(): void {
    this.stopAutoScroll();
    this.timer = setInterval(() => {
      this.goTo((this.activeIndexSignal() + 1) % this.slideCount());
    }, this.intervalMs());
  }

  private stopAutoScroll(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
