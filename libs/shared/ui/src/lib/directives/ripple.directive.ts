import { Directive, ElementRef, Renderer2, inject, input } from '@angular/core';
import { MOBILE_MOTION_DURATIONS_MS } from '../tokens/motion.tokens';

/**
 * Material-style touch feedback: a circle expands from the touch point and fades out. Pure
 * DOM/CSS, no dependencies — the expanding-circle animation itself is the `.mobile-ripple-effect`
 * keyframe in `animations/keyframes.scss` (imported once per app alongside the design tokens).
 *
 * @example <button mobileRipple>Add to cart</button>
 */
@Directive({
  selector: '[mobileRipple]',
  standalone: true,
  host: {
    '(pointerdown)': 'onPointerDown($event)',
  },
})
export class RippleDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);

  /** Disable for elements that already provide their own press feedback. */
  readonly mobileRipple = input(true);

  onPointerDown(event: PointerEvent): void {
    if (!this.mobileRipple()) {
      return;
    }

    const host = this.elementRef.nativeElement;

    if (getComputedStyle(host).position === 'static') {
      this.renderer.setStyle(host, 'position', 'relative');
    }
    this.renderer.setStyle(host, 'overflow', 'hidden');

    const rect = host.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const ripple = this.renderer.createElement('span') as HTMLSpanElement;

    this.renderer.addClass(ripple, 'mobile-ripple-effect');
    this.renderer.setStyle(ripple, 'width', `${size}px`);
    this.renderer.setStyle(ripple, 'height', `${size}px`);
    this.renderer.setStyle(ripple, 'left', `${event.clientX - rect.left - size / 2}px`);
    this.renderer.setStyle(ripple, 'top', `${event.clientY - rect.top - size / 2}px`);
    this.renderer.setStyle(ripple, 'animation-duration', `${MOBILE_MOTION_DURATIONS_MS.slow}ms`);

    this.renderer.appendChild(host, ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }
}
