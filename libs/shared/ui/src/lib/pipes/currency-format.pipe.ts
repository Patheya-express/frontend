import { Pipe, PipeTransform } from '@angular/core';
import { formatCurrency, type CurrencyFormatOptions } from '../utils/currency.utils';

@Pipe({ name: 'currencyFormat', standalone: true })
export class CurrencyFormatPipe implements PipeTransform {
  transform(value: number | null | undefined, options?: CurrencyFormatOptions): string {
    if (value === null || value === undefined) {
      return '';
    }
    return formatCurrency(value, options);
  }
}
