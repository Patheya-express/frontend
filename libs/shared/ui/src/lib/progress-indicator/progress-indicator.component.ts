import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Linear or circular progress — determinate (`[value]` 0–100) or indeterminate (omit `value`).
 * The circular/indeterminate variant reuses the same `.mobile-spinner` keyframe as button
 * loading states (`keyframes.scss`), so there's exactly one spin animation in the whole library.
 *
 * @example <lib-progress-indicator /> <!-- indeterminate circular -->
 * @example <lib-progress-indicator variant="linear" [value]="uploadProgress()" />
 */
@Component({
  selector: 'lib-progress-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'progressbar',
    '[attr.aria-valuenow]': 'value() ?? null',
    '[attr.aria-valuemin]': '0',
    '[attr.aria-valuemax]': '100',
    '[attr.aria-label]': 'ariaLabel() ?? null',
  },
  template: `
    @if (variant() === 'circular') {
      <span class="mobile-spinner" aria-hidden="true"></span>
    } @else {
      <div class="mobile-progress-track">
        <div
          class="mobile-progress-fill"
          [class.mobile-progress-fill--indeterminate]="value() === undefined"
          [style.width.%]="value() ?? 40"
        ></div>
      </div>
    }
  `,
  styles: `
    .mobile-progress-track {
      width: 100%;
      height: 4px;
      border-radius: var(--radius-full);
      background: var(--color-border);
      overflow: hidden;
    }

    .mobile-progress-fill {
      height: 100%;
      border-radius: var(--radius-full);
      background: var(--color-primary);
      transition: width var(--transition-base);
    }

    .mobile-progress-fill--indeterminate {
      animation: mobile-progress-slide 1.1s ease-in-out infinite;
    }

    @keyframes mobile-progress-slide {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(250%);
      }
    }
  `,
})
export class ProgressIndicatorComponent {
  readonly variant = input<'linear' | 'circular'>('circular');
  readonly value = input<number | undefined>(undefined);
  readonly ariaLabel = input<string | undefined>(undefined);

  protected readonly isDeterminate = computed(() => this.value() !== undefined);
}
