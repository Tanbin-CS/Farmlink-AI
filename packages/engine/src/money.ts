/**
 * Money is carried across JSON boundaries as a decimal-digit string of minor units
 * (paisa for BDT). Inside the engine it is a BigInt. Floating point is never used
 * for financial arithmetic.
 */
export type MoneyMinor = string;

/** 1,000,000,000,000 BDT expressed in paisa. Keeps every aggregate below 2^53 so charts stay exact. */
export const MAX_ABS_MINOR = 100_000_000_000_000n;

const MINOR_RE = /^-?(0|[1-9]\d{0,17})$/;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export function isMoneyMinor(value: unknown): value is MoneyMinor {
  if (typeof value !== 'string' || !MINOR_RE.test(value) || value === '-0') return false;
  const v = BigInt(value);
  return v <= MAX_ABS_MINOR && v >= -MAX_ABS_MINOR;
}

export function toBig(value: MoneyMinor): bigint {
  if (!isMoneyMinor(value)) throw new MoneyError(`Invalid money amount: ${String(value)}`);
  return BigInt(value);
}

export function fromBig(value: bigint): MoneyMinor {
  if (value > MAX_ABS_MINOR || value < -MAX_ABS_MINOR) {
    throw new MoneyError('Amount exceeds the supported range');
  }
  return value.toString();
}

/** Round-half-up integer division for a non-negative numerator and positive denominator. */
export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new MoneyError('Denominator must be positive');
  if (numerator < 0n) throw new MoneyError('Numerator must be non-negative');
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/**
 * Parse a user-entered major-unit amount ("12,500.50" or "12500") into minor units.
 * Rejects more than two decimals, exponents, and anything outside the supported range.
 */
export function parseMajor(input: string, opts: { allowNegative?: boolean } = {}): MoneyMinor {
  const cleaned = input.trim().replace(/,/g, '').replace(/^(BDT|USD|EUR|CNY|RMB|৳|\$|€|¥)\s*/i, '');
  const m = /^(-)?(\d{1,15})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!m) throw new MoneyError('Enter an amount like 12500 or 12500.50 (max two decimals)');
  const [, sign, whole, frac = ''] = m;
  if (sign && !opts.allowNegative) throw new MoneyError('Amount cannot be negative');
  const minor = BigInt(whole!) * 100n + BigInt(frac.padEnd(2, '0'));
  return fromBig(sign ? -minor : minor);
}

export type CurrencyCode = 'BDT' | 'USD' | 'EUR' | 'CNY';
export const CURRENCIES: readonly CurrencyCode[] = ['BDT', 'USD', 'EUR', 'CNY'] as const;
export const CURRENCY_NAMES: Record<CurrencyCode, string> = { BDT: 'Bangladeshi taka', USD: 'US dollar', EUR: 'euro', CNY: 'Chinese yuan' };
export type DigitGrouping = 'international' | 'south_asian';

/** Group digits in the South Asian lakh/crore style: 12,34,56,789. */
function groupLakh(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return `${parts.join(',')},${last3}`;
}

/** Group digits in thousands: 1,234,567. */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatMoney(
  value: MoneyMinor | bigint,
  currency: CurrencyCode,
  opts: { withSymbol?: boolean; grouping?: DigitGrouping; decimals?: boolean } = {},
): string {
  const v = typeof value === 'bigint' ? value : toBig(value);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const showDecimals = opts.decimals ?? true;
  const wholeBig = showDecimals ? abs / 100n : (abs + 50n) / 100n;
  const whole = wholeBig.toString();
  const frac = (abs % 100n).toString().padStart(2, '0');
  const grouped = (opts.grouping ?? 'international') === 'south_asian' ? groupLakh(whole) : groupThousands(whole);
  const prefix = opts.withSymbol === false ? '' : `${currency} `;
  return `${neg ? '-' : ''}${prefix}${grouped}${showDecimals ? `.${frac}` : ''}`;
}

/** BDT formatting with the South Asian (lakh) grouping customary in Bangladesh. */
export function formatBDT(value: MoneyMinor | bigint, opts: { withSymbol?: boolean } = {}): string {
  return formatMoney(value, 'BDT', { ...opts, grouping: 'south_asian' });
}

/** Major-unit string without grouping, suitable for form inputs. */
export function toMajorInput(value: MoneyMinor): string {
  const v = toBig(value);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const frac = abs % 100n;
  return `${neg ? '-' : ''}${abs / 100n}${frac === 0n ? '' : `.${frac.toString().padStart(2, '0')}`}`;
}

/** Safe conversion for chart coordinates only (major units). Values are bounded by MAX_ABS_MINOR. */
export function toChartNumber(value: MoneyMinor | bigint): number {
  const v = typeof value === 'bigint' ? value : toBig(value);
  if (v > MAX_ABS_MINOR || v < -MAX_ABS_MINOR) throw new MoneyError('Value outside chartable range');
  return Number(v) / 100;
}

export function minBig(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export function maxBig(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}
