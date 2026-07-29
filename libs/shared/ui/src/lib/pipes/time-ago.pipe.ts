import { Pipe, PipeTransform } from '@angular/core';

const UNITS: Array<{ limitSeconds: number; divisorSeconds: number; label: string }> = [
  { limitSeconds: 60, divisorSeconds: 1, label: 'just now' },
  { limitSeconds: 3600, divisorSeconds: 60, label: 'm ago' },
  { limitSeconds: 86400, divisorSeconds: 3600, label: 'h ago' },
  { limitSeconds: 604800, divisorSeconds: 86400, label: 'd ago' },
];

/** Formats a timestamp as relative time ("5m ago", "2h ago") for order/notification timelines —
 *  purely presentational string formatting, no domain knowledge of what the timestamp represents.
 *  Falls back to a locale date string beyond 7 days, where relative phrasing stops being useful.
 *
 * @example {{ order.placedAt | mobileTimeAgo }}
 */
@Pipe({
  name: 'mobileTimeAgo',
  standalone: true,
})
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    const elapsedSeconds = Math.max(0, (Date.now() - date.getTime()) / 1000);

    if (elapsedSeconds < UNITS[0].limitSeconds) {
      return UNITS[0].label;
    }

    for (const unit of UNITS.slice(1)) {
      if (elapsedSeconds < unit.limitSeconds) {
        return `${Math.floor(elapsedSeconds / unit.divisorSeconds)}${unit.label}`;
      }
    }

    return date.toLocaleDateString();
  }
}
