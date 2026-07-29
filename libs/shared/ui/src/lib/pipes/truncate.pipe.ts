import { Pipe, PipeTransform } from '@angular/core';

/** Truncates text to `maxLength` characters, breaking on the last whole word where possible —
 *  purely presentational (no formatting/business rules), used by cards/list tiles with
 *  fixed-height text areas. Pure by default (no dependencies), so Angular only re-runs it when
 *  its inputs change.
 *
 * @example {{ restaurant.description | mobileTruncate: 80 }}
 */
@Pipe({
  name: 'mobileTruncate',
  standalone: true,
})
export class TruncatePipe implements PipeTransform {
  transform(value: string | null | undefined, maxLength = 120, ellipsis = '…'): string {
    if (!value || value.length <= maxLength) {
      return value ?? '';
    }

    const truncated = value.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    return `${lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated}${ellipsis}`;
  }
}
