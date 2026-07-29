export interface CurrencyFormatOptions {
  /** Prefixed literally — not passed through `Intl.NumberFormat`'s own currency-symbol lookup, so it always renders exactly as given. */
  currencySymbol?: string;
  decimals?: number;
  locale?: string;
  /** Thousands separator. Off by default to match this codebase's existing plain `₹1234.50`-style formatting. */
  useGrouping?: boolean;
}

const DEFAULT_OPTIONS: Required<CurrencyFormatOptions> = {
  currencySymbol: '₹',
  decimals: 2,
  locale: 'en-IN',
  useGrouping: false,
};

/**
 * Single source of truth for currency display — replaces the workspace's several independent
 * `` `₹${value.toFixed(2)}` `` implementations. Uses `Intl.NumberFormat` for the numeric part
 * (correct locale-aware rounding, e.g. avoids `(1.005).toFixed(2) === '1.00'`-style float bugs)
 * while defaulting to the exact same visual output those call sites already produced.
 */
export function formatCurrency(value: number, options?: CurrencyFormatOptions): string {
  const { currencySymbol, decimals, locale, useGrouping } = { ...DEFAULT_OPTIONS, ...options };

  const formattedNumber = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping,
  }).format(value);

  return `${currencySymbol}${formattedNumber}`;
}
