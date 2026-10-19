import { addDays, diffDays } from './dates';
import { divRoundHalfUp, fromBig, toBig, type MoneyMinor } from './money';
import { projectCashflow, type CashflowResult } from './cashflow';
import type { ProductEvaluation } from './financing';
import type { CashEvent, Workspace } from './schemas';

/**
 * Deterministic "what if" adjustments applied to PLANNED events only. Settled history is
 * never changed. These are user-chosen stress assumptions, not predictions.
 */
export interface Scenario {
  id: string;
  label: string;
  /** Shift planned sales receipts later by N days (harvest or buyer payment delay). */
  salesDelayDays: number;
  /** Percentage change applied to planned sales receipts (e.g. -20 = price or volume drop). */
  salesChangePct: number;
  /** Percentage change applied to planned operating outflows (inputs, transport, operating costs). */
  costChangePct: number;
}

export const SCENARIO_LIMITS = {
  salesDelayDays: { min: 0, max: 90 },
  salesChangePct: { min: -80, max: 50 },
  costChangePct: { min: -50, max: 100 },
} as const;

export const BASELINE_SCENARIO: Scenario = { id: 'baseline', label: 'Records as entered', salesDelayDays: 0, salesChangePct: 0, costChangePct: 0 };

export const STRESS_PRESETS: Scenario[] = [
  { id: 'harvest_late_14', label: 'Harvest receipts 14 days late', salesDelayDays: 14, salesChangePct: 0, costChangePct: 0 },
  { id: 'sales_down_20', label: 'Sales 20% lower', salesDelayDays: 0, salesChangePct: -20, costChangePct: 0 },
  { id: 'costs_up_15', label: 'Input and operating costs 15% higher', salesDelayDays: 0, salesChangePct: 0, costChangePct: 15 },
  { id: 'combined', label: 'Combined: 10 days late, sales -10%, costs +10%', salesDelayDays: 10, salesChangePct: -10, costChangePct: 10 },
];

const COST_CATEGORIES = new Set<CashEvent['category']>(['input_cost', 'transport', 'operating_cost']);

function clampInt(v: number, min: number, max: number): number {
  if (!Number.isInteger(v)) throw new Error('Scenario values must be integers');
  return Math.min(max, Math.max(min, v));
}

export function normalizeScenario(s: Scenario): Scenario {
  return {
    ...s,
    salesDelayDays: clampInt(s.salesDelayDays, SCENARIO_LIMITS.salesDelayDays.min, SCENARIO_LIMITS.salesDelayDays.max),
    salesChangePct: clampInt(s.salesChangePct, SCENARIO_LIMITS.salesChangePct.min, SCENARIO_LIMITS.salesChangePct.max),
    costChangePct: clampInt(s.costChangePct, SCENARIO_LIMITS.costChangePct.min, SCENARIO_LIMITS.costChangePct.max),
  };
}

function scale(amount: MoneyMinor, pct: number): MoneyMinor {
  if (pct === 0) return amount;
  const v = divRoundHalfUp(toBig(amount) * BigInt(100 + pct), 100n);
  return fromBig(v < 1n ? 1n : v);
}

export function applyScenario(events: CashEvent[], scenario: Scenario): CashEvent[] {
  const s = normalizeScenario(scenario);
  return events.map((e) => {
    if (e.status !== 'planned') return e;
    if (e.direction === 'inflow' && e.category === 'sales_receipt') {
      return { ...e, date: s.salesDelayDays ? addDays(e.date, s.salesDelayDays) : e.date, amountMinor: scale(e.amountMinor, s.salesChangePct) };
    }
    if (e.direction === 'outflow' && COST_CATEGORIES.has(e.category)) {
      return { ...e, amountMinor: scale(e.amountMinor, s.costChangePct) };
    }
    return e;
  });
}

export function projectScenario(workspace: Workspace, events: CashEvent[], scenario: Scenario): CashflowResult {
  return projectCashflow(workspace, applyScenario(events, scenario));
}

export interface StressResult {
  scenarioId: string;
  label: string;
  /** Funding gap under the scenario without any financing. */
  stressedGapMinor: MoneyMinor;
  /** Minimum closing cash under the scenario with the SAME principal, dates, and repayment. */
  minClosingWithFinancingMinor: MoneyMinor;
  minClosingDate: string;
  passes: boolean;
}

export interface StressReport {
  productId: string;
  results: StressResult[];
  passed: number;
  total: number;
  verdict: 'resilient' | 'partly_resilient' | 'fragile';
}

/** The loan terms a stress test holds fixed: a costed evaluation or a frozen submission payload. */
export type StressSubject = Pick<ProductEvaluation, 'productId' | 'quote' | 'disbursementDate' | 'maturityDate'>;

/**
 * Repayment stress check: keeps the drafted loan fixed (principal, disbursement, maturity)
 * and asks whether cash stays non-negative through maturity under each adverse scenario.
 * The forecast window is extended to cover maturity so late harvests are not cut off.
 */
export function stressTestOption(workspace: Workspace, events: CashEvent[], evaluation: StressSubject, scenarios: Scenario[] = STRESS_PRESETS): StressReport | null {
  if (!evaluation.quote || !evaluation.disbursementDate || !evaluation.maturityDate) return null;
  const horizon = Math.max(workspace.forecastDays, diffDays(workspace.asOfDate, evaluation.maturityDate) + 1);
  const ws = { ...workspace, forecastDays: horizon as Workspace['forecastDays'] };
  const results = scenarios.map((sc) => {
    const stressed = applyScenario(events, sc);
    const noFin = projectCashflow(ws, stressed);
    const withFin = projectCashflow(ws, stressed, [
      { id: 'stress-in', date: evaluation.disbursementDate!, direction: 'inflow', amountMinor: evaluation.quote!.netCashReceivedMinor, label: 'Modeled net disbursement' },
      { id: 'stress-out', date: evaluation.maturityDate!, direction: 'outflow', amountMinor: evaluation.quote!.maturityRepaymentMinor, label: 'Modeled maturity repayment' },
    ]);
    return {
      scenarioId: sc.id,
      label: sc.label,
      stressedGapMinor: noFin.fundingGapMinor,
      minClosingWithFinancingMinor: withFin.minClosingMinor,
      minClosingDate: withFin.minClosingDate,
      passes: !withFin.minClosingMinor.startsWith('-'),
    };
  });
  const passed = results.filter((r) => r.passes).length;
  return {
    productId: evaluation.productId,
    results,
    passed,
    total: results.length,
    verdict: passed === results.length ? 'resilient' : passed === 0 ? 'fragile' : 'partly_resilient',
  };
}
