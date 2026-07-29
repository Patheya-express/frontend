import { Directive, input, output } from '@angular/core';
import type { MobileSize } from '../types/common.types';

/**
 * Shared inputs and click-guard for Primary/Secondary/Icon buttons — not a usable directive on
 * its own (no selector), extended by each concrete button so "ignore clicks while
 * disabled/loading" and the size/full-width contract isn't three separate implementations.
 * Needs `@Directive()` (not just a plain class) because Angular only allows signal
 * `input()`/`output()` initializers on a class carrying a `@Component`/`@Directive` decorator —
 * that includes an abstract base class subclasses inherit them from.
 */
@Directive()
export abstract class ButtonBase {
  readonly size = input<MobileSize>('md');
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
