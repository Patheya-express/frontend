import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, SimpleChanges, signal } from '@angular/core';
import { MOBILE_MOTION_DURATIONS_MS } from '../tokens/motion.tokens';
import { prefersReducedMotion } from '../animations/reduced-motion.util';

// Matches an optional non-digit prefix, a number (commas allowed, one optional decimal point),
// and an optional non-digit suffix — e.g. "₹1,23,456" → ['₹', '1,23,456', ''], "94%" → ['', '94',
// '%'], "128" → ['', '128', '']. `value` is a plain formatted string by design (see the class doc
// comment on why) rather than a number + format options, so this is how the animation recovers
// the numeric core to tween without needing to know the specific formatting rule that produced it.
const NUMERIC_VALUE_PATTERN = /^(\D*)([\d,]+(?:\.\d+)?)(\D*)$/;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * `value` stays a plain formatted string (not a `number` + format options) — callers already
 * produce exactly the display string they want (`String(count)`, `formatCurrency(amount)`, or a
 * non-numeric status label like "Healthy"), and this component has no business knowing every
 * formatting rule across every consumer. The count-up animation below works by pattern-matching
 * the numeric core out of whatever string it's given (see NUMERIC_VALUE_PATTERN) and re-inserting
 * an interpolated number in its place each frame — a value that doesn't look like "number with
 * optional prefix/suffix" (e.g. "Healthy") just renders as-is, no animation attempted.
 */
@Component({
  selector: 'lib-metric-card',
  standalone: true,
  templateUrl: './metric-card.component.html',
  styleUrl: './metric-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricCardComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: string;

  protected readonly displayValue = signal('');

  private previousNumeric: number | null = null;
  private animationFrame?: number;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['value']) {
      return;
    }
    this.animateToValue(this.value);
  }

  ngOnDestroy(): void {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  private animateToValue(value: string): void {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
    }

    const match = NUMERIC_VALUE_PATTERN.exec(value);
    if (!match) {
      this.previousNumeric = null;
      this.displayValue.set(value);
      return;
    }

    const [, prefix, numberText, suffix] = match;
    const target = Number(numberText.replace(/,/g, ''));
    const decimals = numberText.includes('.') ? numberText.split('.')[1].length : 0;

    if (Number.isNaN(target) || prefersReducedMotion()) {
      this.previousNumeric = target;
      this.displayValue.set(value);
      return;
    }

    const start = this.previousNumeric ?? 0;
    this.previousNumeric = target;

    if (start === target) {
      this.displayValue.set(value);
      return;
    }

    const durationMs = MOBILE_MOTION_DURATIONS_MS.slower;
    const startTime = performance.now();

    const tick = (now: number): void => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const current = start + (target - start) * easeOutCubic(progress);

      const formatted = current.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      this.displayValue.set(`${prefix}${formatted}${suffix}`);

      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(tick);
      }
    };

    this.animationFrame = requestAnimationFrame(tick);
  }
}
