import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Standard page padding/max-width wrapper — reuses the web design system's existing
 * `--content-max-width` token (`theme.scss`) so a shared component happens to render at the same
 * width cap on a tablet-sized native shell as it would on web, without redefining that number.
 *
 * @example <mobile-page-container><h1>Checkout</h1>…</mobile-page-container>
 */
@Component({
  selector: 'mobile-page-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content />`,
  styles: `
    :host {
      display: block;
      width: 100%;
      max-width: var(--content-max-width);
      margin-inline: auto;
      padding-inline: var(--space-4);
    }
  `,
})
export class PageContainerComponent {}
