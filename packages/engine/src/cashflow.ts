import { addDays, type CivilDate } from './dates';
import { fromBig, toBig, type MoneyMinor } from './money';
import type { CashEvent, Workspace } from './schemas';

export const ENGINE_VERSION = '1.0.0';

export type AlertLevel = 'none' | 'low' | 'critical';

export interface CashflowDay {
  date: CivilDate;
  openingMinor: MoneyMinor;
  inflowPlannedMinor: MoneyMinor;
  inflowSettledMinor: MoneyMinor;
  outflowPlannedMinor: MoneyMinor;
  outflowSettledMinor: MoneyMinor;
  closingMinor: MoneyMinor;
  alert: AlertLevel;
  eventIds: string[];
}

export interface CashflowAlert {
  date: CivilDate;
  level: Exclude<AlertLevel, 'none'>;
  closingMinor: MoneyMinor;
  message: string;
}

/** An extra synthetic movement (for example a modeled loan disbursement) added to a copy of the projection. */
export interface ProjectionAdjustment {
  id: string;
  date: CivilDate;
  direction: 'inflow' | 'outflow';
  amountMinor: MoneyMinor;
  label: string;
}

export interface CashflowResult {
  engineVersion: string;
  workspaceVersion: number;
  window: { start: CivilDate; end: CivilDate; days: number };
  openingCashMinor: MoneyMinor;
  bufferMinor: MoneyMinor;
  days: CashflowDay[];
  alerts: CashflowAlert[];
  earliestNegativeDate: CivilDate | null;
  earliestBelowBufferDate: CivilDate | null;
  minClosingMinor: MoneyMinor;
  minClosingDate: CivilDate;
  /** max(0, -minimum projected closing balance) */
  fundingGapMinor: MoneyMinor;
  /** max(0, buffer - minimum projected closing balance) */
  bufferShortfallMinor: MoneyMinor;
  totals: { inflowMinor: MoneyMinor; outflowMinor: MoneyMinor; netMinor: MoneyMinor; endingCashMinor: MoneyMinor };
  overduePlanned: Array<Pick<CashEvent, 'id' | 'direction' | 'amountMinor' | 'date' | 'description' | 'sourceRef'>>;
  counts: { included: number; cancelled: number; settledBeforeWindow: number; afterWindow: number; overdue: number };
  adjustments: ProjectionAdjustment[];
  assumptions: string[];
  warnings: string[];
}

export const CASHFLOW_ASSUMPTIONS = [
  'Opening cash is the balance available at the start of the as-of date.',
  'Settled events dated before the as-of date are already reflected in opening cash and are not added again.',
  'Planned events dated before the as-of date are overdue: they are listed separately and excluded until rescheduled or settled.',
  'Cancelled events are excluded.',
  'Same-day inflows and outflows are netted at day end; intraday liquidity is not estimated.',
  'This is a cash-based projection, not accounting profit. It depends entirely on the records and assumptions provided.',
] as const;

/**
 * Deterministic daily cash-flow projection. Identical inputs produce identical outputs
 * in the browser sandbox and in the API.
 */
export function projectCashflow(
  workspace: Pick<Workspace, 'asOfDate' | 'forecastDays' | 'openingCashMinor' | 'minimumCashBufferMinor' | 'version' | 'currency'>,
  events: CashEvent[],
  adjustments: ProjectionAdjustment[] = [],
): CashflowResult {
  const start = workspace.asOfDate;
  const end = addDays(start, workspace.forecastDays - 1);
  const buffer = toBig(workspace.minimumCashBufferMinor);
  const warnings: string[] = [];

  const ids = new Set<string>();
  for (const e of events) {
    if (ids.has(e.id)) throw new Error(`Duplicate event id: ${e.id}`);
    ids.add(e.id);
  }

  type Bucket = { inP: bigint; inS: bigint; outP: bigint; outS: bigint; ids: string[] };
  const buckets = new Map<CivilDate, Bucket>();
  const bucket = (d: CivilDate) => {
    let b = buckets.get(d);
    if (!b) {
      b = { inP: 0n, inS: 0n, outP: 0n, outS: 0n, ids: [] };
      buckets.set(d, b);
    }
    return b;
  };

  const counts = { included: 0, cancelled: 0, settledBeforeWindow: 0, afterWindow: 0, overdue: 0 };
  const overduePlanned: CashflowResult['overduePlanned'] = [];

  for (const e of events) {
    if (e.status === 'cancelled') {
      counts.cancelled++;
      continue;
    }
    if (e.date < start) {
      if (e.status === 'planned') {
        counts.overdue++;
        overduePlanned.push({
          id: e.id,
          direction: e.direction,
          amountMinor: e.amountMinor,
          date: e.date,
          description: e.description,
          sourceRef: e.sourceRef,
        });
      } else {
        counts.settledBeforeWindow++;
      }
      continue;
    }
    if (e.date > end) {
      counts.afterWindow++;
      continue;
    }
    if (e.status === 'settled' && e.date > start) {
      warnings.push(`Event ${e.id} is marked settled but dated after the as-of date; treated as a settled movement on ${e.date}.`);
    }
    counts.included++;
    const b = bucket(e.date);
    const amt = toBig(e.amountMinor);
    if (e.direction === 'inflow') {
      if (e.status === 'settled') b.inS += amt;
      else b.inP += amt;
    } else if (e.status === 'settled') b.outS += amt;
    else b.outP += amt;
    b.ids.push(e.id);
  }

  for (const a of adjustments) {
    if (a.date < start || a.date > end) continue;
    const b = bucket(a.date);
    const amt = toBig(a.amountMinor);
    if (a.direction === 'inflow') b.inP += amt;
    else b.outP += amt;
    b.ids.push(a.id);
  }

  const days: CashflowDay[] = [];
  const alerts: CashflowAlert[] = [];
  let balance = toBig(workspace.openingCashMinor);
  let minBal: bigint | null = null;
  let minDate = start;
  let earliestNegative: CivilDate | null = null;
  let earliestBelowBuffer: CivilDate | null = null;
  let totalIn = 0n;
  let totalOut = 0n;

  for (let i = 0; i < workspace.forecastDays; i++) {
    const date = addDays(start, i);
    const b = buckets.get(date) ?? { inP: 0n, inS: 0n, outP: 0n, outS: 0n, ids: [] };
    const opening = balance;
    const inflow = b.inP + b.inS;
    const outflow = b.outP + b.outS;
    totalIn += inflow;
    totalOut += outflow;
    balance = opening + inflow - outflow;
    let alert: AlertLevel = 'none';
    if (balance < 0n) {
      alert = 'critical';
      earliestNegative ??= date;
      alerts.push({ date, level: 'critical', closingMinor: fromBig(balance), message: 'Projected closing cash is negative.' });
    } else if (balance < buffer) {
      alert = 'low';
      alerts.push({ date, level: 'low', closingMinor: fromBig(balance), message: 'Projected closing cash is below the minimum buffer.' });
    }
    if (balance < buffer) earliestBelowBuffer ??= date;
    if (minBal === null || balance < minBal) {
      minBal = balance;
      minDate = date;
    }
    days.push({
      date,
      openingMinor: fromBig(opening),
      inflowPlannedMinor: fromBig(b.inP),
      inflowSettledMinor: fromBig(b.inS),
      outflowPlannedMinor: fromBig(b.outP),
      outflowSettledMinor: fromBig(b.outS),
      closingMinor: fromBig(balance),
      alert,
      eventIds: b.ids,
    });
  }

  const min = minBal ?? balance;
  if (events.length === 0) warnings.push('No cash events recorded. The projection only reflects opening cash.');
  if (counts.overdue > 0) {
    warnings.push(`${counts.overdue} planned event(s) are dated before the as-of date and are excluded until rescheduled or settled.`);
  }

  return {
    engineVersion: ENGINE_VERSION,
    workspaceVersion: workspace.version,
    window: { start, end, days: workspace.forecastDays },
    openingCashMinor: workspace.openingCashMinor,
    bufferMinor: workspace.minimumCashBufferMinor,
    days,
    alerts,
    earliestNegativeDate: earliestNegative,
    earliestBelowBufferDate: earliestBelowBuffer,
    minClosingMinor: fromBig(min),
    minClosingDate: minDate,
    fundingGapMinor: fromBig(min < 0n ? -min : 0n),
    bufferShortfallMinor: fromBig(min < buffer ? buffer - min : 0n),
    totals: {
      inflowMinor: fromBig(totalIn),
      outflowMinor: fromBig(totalOut),
      netMinor: fromBig(totalIn - totalOut),
      endingCashMinor: fromBig(balance),
    },
    overduePlanned,
    counts,
    adjustments,
    assumptions: [...CASHFLOW_ASSUMPTIONS],
    warnings,
  };
}
