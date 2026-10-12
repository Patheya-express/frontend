import { Directive, ElementRef, inject } from '@angular/core';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Whether a focusable element is actually rendered. This used to be `offsetParent !== null`, which
 * is also null for `position: fixed` elements (a fixed action bar inside a sheet was silently
 * dropped from the trap) and always null in layout-less environments such as jsdom (where the
 * trap therefore never wrapped). `checkVisibility()` where available; otherwise walk up checking
 * `hidden` and computed display/visibility.
 */
function isRendered(element: HTMLElement): boolean {
  if (typeof element.checkVisibility === 'function') {
    return element.checkVisibility({ visibilityProperty: true });
  }

  for (
    let node: HTMLElement | null = element;
    node;
    node = node.parentElement
  ) {
    if (node.hidden) {
      return false;
    }
    const style = node.ownerDocument.defaultView?.getComputedStyle(node);
    if (style && (style.display === 'none' || style.visibility === 'hidden')) {
      return false;
    }
  }

  return true;
}

/**
 * Keeps Tab/Shift+Tab cycling within the host element instead of escaping into background page
 * content — the missing half of `aria-modal="true"` for keyboard users (a backdrop already blocks
 * pointer interaction; this closes the same gap for the keyboard). Apply to the dialog/sheet
 * surface itself, alongside `role="dialog"`/`aria-modal="true"`, `tabindex="-1"` and
 * `mobileAutoFocus`.
 *
 * @example
 * <div class="sheet-panel" role="dialog" aria-modal="true" tabindex="-1" mobileAutoFocus libFocusTrap>
 */
@Directive({
  selector: '[libFocusTrap]',
  standalone: true,
  host: {
    // Angular key bindings match modifiers exactly — `keydown.tab` never fires with Shift held
    // (that event is `shift.tab`), so Shift+Tab needs its own binding to stay trapped.
    '(keydown.tab)': 'onTab($event)',
    '(keydown.shift.tab)': 'onTab($event)',
  },
})
export class FocusTrapDirective {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  onTab(rawEvent: Event): void {
    const event = rawEvent as KeyboardEvent;
    const hostEl = this.elementRef.nativeElement;
    const focusable = (
      Array.from(hostEl.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[]
    ).filter(isRendered);

    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = hostEl.ownerDocument.activeElement as HTMLElement | null;

    // Focus is on the panel itself (just after mobileAutoFocus ran) or has somehow landed outside
    // the trap entirely — either way, the first Tab/Shift+Tab should land on a real boundary.
    if (active === hostEl || !hostEl.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
