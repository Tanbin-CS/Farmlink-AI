import { toBig, type CurrencyCode, type MoneyMinor } from './money';

/**
 * Display-only currency conversion. Rates are "units of BDT per 1 unit of currency" with up
 * to 4 decimals, supplied by the user. They never feed financial calculations, comparisons,
 * or submissions, which always use the workspace currency.
 */
export type ReferenceRates = Record<Exclude<CurrencyCode, 'BDT'>, string>;

/**
 * Bangladesh Bank USD/BDT reference rate, 19 Oct 2026 (05:00 PM). EUR derived via EUR/USD ≈ 1.1221;
 * CNY derived via USD/CNY 6.6861 (US Federal Reserve H.10, 16 Oct 2026). Editable.
 */
export const DEFAULT_REFERENCE_RATES: ReferenceRates = { USD: '123.7054', EUR: '138.8098', CNY: '18.5019' };
export const DEFAULT_RATES_NOTE =
  'Default USD rate: Bangladesh Bank reference rate, 19 Oct 2026 (123.7054 BDT). EUR derived with EUR/USD ≈ 1.1221; CNY derived with USD/CNY 6.6861 (US Federal Reserve H.10, 16 Oct 2026). Display only, not live market data.';

const RATE_RE = /^\d{1,6}(\.\d{1,4})?$/;

export function isValidRate(rate: string): boolean {
  return RATE_RE.test(rate) && Number(rate) > 0;
}

/** Rate scaled by 10,000 as an integer. */
function scaled(currency: CurrencyCode, rates: ReferenceRates): bigint {
  if (currency === 'BDT') return 10_000n;
  const r = rates[currency];
  if (!isValidRate(r)) throw new Error(`Invalid reference rate for ${currency}`);
  const [w, f = ''] = r.split('.');
  return BigInt(w!) * 10_000n + BigInt(f.padEnd(4, '0'));
}

/** Converts minor units between currencies via BDT, rounding half away from zero. */
export function convertMinor(value: MoneyMinor, from: CurrencyCode, to: CurrencyCode, rates: ReferenceRates): MoneyMinor {
  if (from === to) return value;
  const v = toBig(value);
  const num = (v < 0n ? -v : v) * scaled(from, rates);
  const den = scaled(to, rates);
  const q = (num * 2n + den) / (den * 2n);
  return (v < 0n && q !== 0n ? -q : q).toString();
}
