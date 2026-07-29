import { Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

/**
 * Focuses the host element once it's actually rendered — typical use: the primary field in a
 * bottom sheet/dialog/search bar that just opened, so the keyboard shows immediately without an
 * extra tap. `afterNextRender` (rather than `ngAfterViewInit`) so focus happens after the browser
 * has painted the element, which matters when it's appearing inside an animated overlay.
 *
 * @example <input mobileAutoFocus [mobileAutoFocus]="isFirstStep()" />
 */
@Directive({
  selector: '[mobileAutoFocus]',
  standalone: true,
})
export class AutoFocusDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  /** Set to `false` to opt out conditionally without removing the directive from the template. */
  readonly mobileAutoFocus = input(true);

  constructor() {
    afterNextRender(() => {
      if (this.mobileAutoFocus()) {
        this.elementRef.nativeElement.focus({ preventScroll: true });
      }
    });
  }
}
