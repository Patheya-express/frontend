import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ButtonBase } from './button-base';

/**
 * Icon-only tap target (app bar actions, list-tile trailing actions). `ariaLabel` is required,
 * not optional — an icon-only button with no accessible name is invisible to screen readers, so
 * the type system enforces one is always provided (see accessibility notes in the README).
 *
 * @example
 * <lib-icon-button ariaLabel="Add to favorites" (buttonClick)="toggleFavorite()">
 *   <svg mobileIcon>…</svg>
 * </lib-icon-button>
 */
@Component({
  selector: 'lib-icon-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon-button.component.html',
  styleUrl: './icon-button.component.scss',
})
export class IconButtonComponent extends ButtonBase {
  readonly ariaLabel = input.required<string>();
}
