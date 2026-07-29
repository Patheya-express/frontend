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
      (valueChange)="valueChange.emit($event)"
    />
    @if (value()) {
      <lib-icon-button size="sm" ariaLabel="Clear search" (buttonClick)="onClear()">×</lib-icon-button>
    }
    @if (showCancel()) {
      <button type="button" class="lib-search-bar__cancel" (click)="cancelled.emit()">Cancel</button>
    }
  `,
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
  `,
})
export class SearchBarComponent {
  readonly value = input('');
  readonly placeholder = input('Search…');
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly disabled = input(false);
  readonly showCancel = input(false);

  readonly valueChange = output<string>();
  readonly cleared = output<void>();
  readonly cancelled = output<void>();

  onClear(): void {
    this.valueChange.emit('');
    this.cleared.emit();
  }
}
