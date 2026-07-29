import { Directive, ElementRef, Renderer2, inject } from '@angular/core';

/**
 * Applies native lazy-loading/async-decoding to `<img>` elements and fades them in once loaded.
 * Deliberately thin — the WebViews Capacitor ships (Chromium on Android, WKWebView on iOS) both
 * implement `loading="lazy"` well, so this doesn't reinvent an IntersectionObserver-based loader
 * that would just be a slower, more complex version of a feature the platform already has.
 *
 * @example <img mobileLazyImage [src]="restaurant.imageUrl" alt="" />
 */
@Directive({
  selector: 'img[mobileLazyImage]',
  standalone: true,
  host: {
    loading: 'lazy',
    decoding: 'async',
    class: 'mobile-lazy-image',
    '(load)': 'onLoad()',
  },
})
export class LazyImageDirective {
  private readonly elementRef = inject(ElementRef<HTMLImageElement>);
  private readonly renderer = inject(Renderer2);

  onLoad(): void {
    this.renderer.addClass(this.elementRef.nativeElement, 'mobile-lazy-image--loaded');
  }
}
