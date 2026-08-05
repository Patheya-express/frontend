import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SearchInputComponent } from '../search-input/search-input.component';
import { IconButtonComponent } from '../buttons/icon-button.component';

/**
 * Full search-bar chrome around the existing `SearchInputComponent` (not a second text-input
 * implementation): leading icon slot, `SearchInputComponent` itself for the debounced input, a
 * clear (×) button once there's text, and an optional trailing "Cancel" affordance for the
 * iOS-style "tap to search, tap Cancel to dismiss" flow. Where `SearchInputComponent` alone is
 * enough (most desktop toolbars), keep using it directly — this is for screens that want the
 * fuller mobile-style affordance.
 *
 * @example
 * <lib-search-bar
 *   ariaLabel="Search restaurants"
 *   [value]="query()"
 *   (valueChange)="query.set($event)"
 *   (cleared)="query.set('')"
 *   showCancel
 *   (cancelled)="closeSearch()"
 * />
 */
@Component({
  selector: 'lib-search-bar',
  standalone: true,
  imports: [SearchInputComponent, IconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="lib-search-bar__icon" aria-hidden="true">
      <ng-content select="[libIcon]" />
    </span>
    <lib-search-input
      class="lib-search-bar__field"
      [ariaLabel]="ariaLabel()"
      [placeholder]="placeholder()"
      [value]="value()"
      [disabled]="disabled()"
      [variant]="variant()"
      (valueChange)="valueChange.emit($event)"
    />
    @if (value()) {
      <lib-icon-button size="sm" ariaLabel="Clear search" (buttonClick)="onClear()">×</lib-icon-button>
    }
    @if (showCancel()) {
      <button type="button" class="lib-search-bar__cancel" (click)="cancelled.emit()">Cancel</button>
    }
  `,
  host: {
    '[class.lib-search-bar--neo-glass]': "variant() === 'neo-glass'",
  },
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .lib-search-bar__icon {
      display: inline-flex;
      color: var(--color-text-subtle);
      flex-shrink: 0;
    }

    .lib-search-bar__field {
      flex: 1;
      min-width: 0;
    }

    .lib-search-bar__cancel {
      flex-shrink: 0;
      min-height: var(--touch-target-min);
      padding: 0 var(--space-2);
      border: none;
      background: transparent;
      color: var(--color-primary);
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
    }

    /* Neo-Glass opt-in — the icon overlays the pill as a true leading icon (absolutely positioned,
       vertically centered) instead of sitting in normal flex flow next to it, since
       lib-search-input's own ".search-input--neo-glass" already renders as a self-contained pill.
       :host needs position: relative to anchor that overlay. The field's own left padding is
       pushed out to match (icon inset + icon width + a comfortable gap) so the icon and the
       placeholder text never collide — this is the fix for the previous version, which moved the
       icon into the pill but never made room for it. */
    :host(.lib-search-bar--neo-glass) {
      position: relative;
    }

    :host(.lib-search-bar--neo-glass) .lib-search-bar__icon {
      position: absolute;
      left: var(--space-4);
      top: 50%;
      transform: translateY(-50%);
      z-index: 1;
      pointer-events: none;
    }

    :host(.lib-search-bar--neo-glass) ::ng-deep .lib-search-bar__field .search-input--neo-glass {
      /* icon inset (--space-4) + icon width (20px) + breathing room (--space-2) */
      padding-left: calc(var(--space-4) + 20px + var(--space-2));
    }
  `,
})
export class SearchBarComponent {
  readonly value = input('');
  readonly placeholder = input('Search…');
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly disabled = input(false);
  readonly showCancel = input(false);
  /** Visual treatment — 'flat' (default) leaves every existing call site unchanged; 'neo-glass'
   *  opts into the soft-neumorphic pill, forwarded straight to the inner `lib-search-input`. */
  readonly variant = input<'flat' | 'neo-glass'>('flat');

  readonly valueChange = output<string>();
  readonly cleared = output<void>();
  readonly cancelled = output<void>();

  onClear(): void {
    this.valueChange.emit('');
    this.cleared.emit();
  }
}
