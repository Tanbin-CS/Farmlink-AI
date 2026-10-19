/**
 * Civil (calendar) dates as YYYY-MM-DD strings. They are never converted to instants;
 * arithmetic uses a proleptic day number so results are identical in every time zone.
 */
export type CivilDate = string;

/** Display time zone for business context. Execution timestamps are UTC RFC 3339. */
export const BUSINESS_TIME_ZONE = 'Asia/Dhaka';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, m: number): number {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;
}

export function isCivilDate(value: unknown): value is CivilDate {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return y >= 1900 && y <= 2200 && mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

function assertDate(value: CivilDate): [number, number, number] {
  if (!isCivilDate(value)) throw new Error(`Invalid calendar date: ${String(value)}`);
  const m = DATE_RE.exec(value)!;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Days since 1970-01-01 using the civil-from-days algorithm (Howard Hinnant). */
export function toDayNumber(date: CivilDate): number {
  const [y0, m, d] = assertDate(date);
  const y = m <= 2 ? y0 - 1 : y0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export function fromDayNumber(n: number): CivilDate {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function addDays(date: CivilDate, days: number): CivilDate {
  if (!Number.isInteger(days)) throw new Error('Day offset must be an integer');
  return fromDayNumber(toDayNumber(date) + days);
}

export function diffDays(from: CivilDate, to: CivilDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** Today's civil date in the business time zone. */
export function todayInBusinessZone(now: Date = new Date()): CivilDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parts;
}

export function formatCivilDate(date: CivilDate): string {
  const [y, m, d] = assertDate(date);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
  return `${d} ${month} ${y}`;
}
