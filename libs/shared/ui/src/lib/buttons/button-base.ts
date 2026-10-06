import { Directive, input, output } from '@angular/core';
import type { MobileSize } from '../types/common.types';

/** The two HTML button types this workspace's shared buttons actually need — `'reset'`/`'menu'`
 *  have no current consumer and are deliberately not exposed (see `type`'s own doc comment). */
export type MobileButtonType = 'button' | 'submit';

/**
 * Shared inputs and click-guard for Primary/Secondary/Link/Icon buttons — not a usable directive
 * on its own (no selector), extended by each concrete button so "ignore clicks while
 * disabled/loading" and the size/full-width/type contract isn't four separate implementations.
 * Needs `@Directive()` (not just a plain class) because Angular only allows signal
 * `input()`/`output()` initializers on a class carrying a `@Component`/`@Directive` decorator —
 * that includes an abstract base class subclasses inherit them from.
 */
@Directive()
export abstract class ButtonBase {
  readonly size = input<MobileSize>('md');
  /** Defaults to `'button'`, matching every existing call site's current (previously hardcoded)
   *  behavior exactly. Set to `'submit'` to let this button trigger a surrounding `<form>`'s
   *  native submission (and therefore its `(ngSubmit)` handler) — the button's own `buttonClick`
   *  output still fires independently on every click regardless of `type`; for a `type="submit"`
   *  button inside a form, leave `buttonClick` unbound and let `(ngSubmit)` be the single source
   *  of truth, exactly as a hand-written `<button type="submit">` with no `(click)` already
   *  behaves — binding both would submit twice. */
  readonly type = input<MobileButtonType>('button');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly fullWidth = input(false);
  readonly buttonClick = output<void>();

  protected handleClick(): void {
    if (this.disabled() || this.loading()) {
      return;
    }

    this.buttonClick.emit();
  }
}
