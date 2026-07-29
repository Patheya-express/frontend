import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Thin separator line — horizontal (default, for stacked sections/list groups) or vertical (for
 * inline chip/button groups). Optionally carries an inset (aligns with list-tile text instead of
 * running edge to edge) and a centered label (e.g. "Today" between grouped list sections).
 *
 * @example <lib-divider />
 * @example <lib-divider inset="72px" />
 * @example <lib-divider label="Today" />
 */
@Component({
  selector: 'lib-divider',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'separator',
    '[attr.aria-orientation]': 'orientation()',
    '[class.mobile-divider--vertical]': "orientation() === 'vertical'",
    '[style.margin-inline-start]': "orientation() === 'horizontal' ? inset() : null",
  },
  template: `
    @if (label()) {
      <span class="mobile-divider__label">{{ label() }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      height: 1px;
      background: var(--color-border);
      border: none;
    }

    :host(.mobile-divider--vertical) {
      display: inline-block;
      width: 1px;
      height: 100%;
      background: var(--color-border);
    }

    .mobile-divider__label {
      flex-shrink: 0;
      padding: 0 var(--space-2);
      background: var(--color-background);
      color: var(--color-text-subtle);
      font-size: var(--font-size-xs);
      transform: translateY(-50%);
    }
  `,
})
export class DividerComponent {
  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
  readonly inset = input<string | null>(null);
  readonly label = input<string | null>(null);
}
