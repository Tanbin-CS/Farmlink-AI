import { addDays, type CivilDate } from './dates';
import { divRoundHalfUp, fromBig, toBig, type MoneyMinor } from './money';
import { projectCashflow, type CashflowResult } from './cashflow';
import { SUPPORTED_REPAYMENT_TYPE, type CashEvent, type EvidenceType, type FinancingProduct, type Workspace } from './schemas';

export type FitStatus = 'fits' | 'does_not_fit' | 'needs_information';

export type ReasonCode =
  | 'NO_FUNDING_GAP'
  | 'CURRENCY_MISMATCH'
  | 'MISSING_TERMS'
  | 'UNSUPPORTED_COST_STRUCTURE'
  | 'INELIGIBLE_BUSINESS_TYPE'
  | 'MISSING_EVIDENCE'
  | 'FUNDING_CAP'
  | 'DELAYED_DISBURSEMENT'
  | 'INCOMPLETE_HORIZON'
  | 'SHORTAGE_AFTER_REPAYMENT';

export const REASON_TEXT: Record<ReasonCode, string> = {
  NO_FUNDING_GAP: 'No negative cash is projected in the window, so no financing is needed.',
  CURRENCY_MISMATCH: 'Product currency differs from the workspace currency; amounts are never converted silently.',
  MISSING_TERMS: 'Essential cost or term fields are unknown; this option cannot be costed or ranked.',
  UNSUPPORTED_COST_STRUCTURE: 'Repayment structure is not supported by this prototype model (simple interest, one bullet repayment).',
  INELIGIBLE_BUSINESS_TYPE: 'Business type is not in the product’s stated eligibility.',
  MISSING_EVIDENCE: 'Required supporting evidence is not marked as available in the workspace.',
  FUNDING_CAP: 'Even the maximum principal does not provide enough net cash to cover the gap.',
  DELAYED_DISBURSEMENT: 'Funds would arrive after the first projected negative-cash date.',
  INCOMPLETE_HORIZON: 'Repayment assessment incomplete: forecast ends before maturity.',
  SHORTAGE_AFTER_REPAYMENT: 'Projected cash goes negative again after including the maturity repayment.',
};

export interface Quote {
  principalMinor: MoneyMinor;
  feeMinor: MoneyMinor;
  interestMinor: MoneyMinor;
  netCashReceivedMinor: MoneyMinor;
  maturityRepaymentMinor: MoneyMinor;
  totalFinancingCostMinor: MoneyMinor;
}

export interface ProductEvaluation {
  productId: string;
  productName: string;
  provider: string;
  classification: FinancingProduct['classification'];
  status: FitStatus;
  reasons: ReasonCode[];
  missingEvidence: EvidenceType[];
  quote: Quote | null;
  disbursementDate: CivilDate | null;
  maturityDate: CivilDate | null;
  /** Minimum projected closing cash with the modeled financing included (if computed). */
  minClosingWithFinancingMinor: MoneyMinor | null;
  rank: number | null;
}

export interface FinancingComparison {
  engineVersion: string;
  workspaceVersion: number;
  catalogVersion: number;
  fundingGapMinor: MoneyMinor;
  /** Net cash each option must provide (gap, or gap plus buffer). */
  requiredNetCashMinor: MoneyMinor;
  financingTarget: Workspace['financingTarget'];
  earliestNegativeDate: CivilDate | null;
  evaluations: ProductEvaluation[];
  bestFitProductId: string | null;
  assumptions: string[];
  notes: string[];
}

export const FINANCING_ASSUMPTIONS = [
  'Supported model: simple annual interest, optional upfront fee (percentage plus fixed), one bullet repayment at maturity.',
  'Interest = round_half_up(P × rate_bps × term_days / (10,000 × 365)); fee = fixed fee + round_half_up(P × fee_bps / 10,000).',
  'Net cash received = principal − upfront fee. Principal is the smallest amount within product limits whose net cash covers the funding gap.',
  'Disbursement is modeled at the as-of date plus the stated delay; repayment of principal plus interest at disbursement plus term.',
  '“Fits” means it fits the stated sandbox rules only. It is not a loan approval, an offer, or a creditworthiness assessment.',
  'Financing comparison is informational, not a loan approval or guarantee.',
] as const;

export function quoteFor(product: FinancingProduct, principal: bigint): Quote {
  const rate = BigInt(product.annualSimpleRateBps ?? 0);
  const feeBps = BigInt(product.upfrontFeeBps ?? 0);
  const fixedFee = toBig(product.upfrontFixedFeeMinor ?? '0');
  const days = BigInt(product.termDays ?? 0);
  const fee = fixedFee + divRoundHalfUp(principal * feeBps, 10_000n);
  const interest = divRoundHalfUp(principal * rate * days, 10_000n * 365n);
  return {
    principalMinor: fromBig(principal),
    feeMinor: fromBig(fee),
    interestMinor: fromBig(interest),
    netCashReceivedMinor: fromBig(principal - fee),
    maturityRepaymentMinor: fromBig(principal + interest),
    totalFinancingCostMinor: fromBig(fee + interest),
  };
}

function netFor(product: FinancingProduct, principal: bigint): bigint {
  return toBig(quoteFor(product, principal).netCashReceivedMinor);
}

/**
 * Smallest principal in [min, max] whose net proceeds cover `need`. Net proceeds are
 * monotonic non-decreasing in principal because fee_bps < 10,000, so a binary search is exact.
 */
export function minimumPrincipal(product: FinancingProduct, need: bigint): bigint | null {
  let lo = toBig(product.principalMinMinor);
  let hi = toBig(product.principalMaxMinor);
  if (netFor(product, hi) < need) return null;
  if (netFor(product, lo) >= need) return lo;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    if (netFor(product, mid) >= need) hi = mid;
    else lo = mid + 1n;
  }
  return lo;
}

function hasCompleteTerms(p: FinancingProduct): boolean {
  return p.annualSimpleRateBps !== null && p.upfrontFeeBps !== null && p.upfrontFixedFeeMinor !== null && p.termDays !== null;
}

/** Net cash the financing must provide, per the workspace's financing target. */
export function financingNeed(workspace: Pick<Workspace, 'financingTarget'>, baseline: CashflowResult): bigint {
  return toBig(workspace.financingTarget === 'gap_plus_buffer' ? baseline.bufferShortfallMinor : baseline.fundingGapMinor);
}

export function evaluateProduct(
  workspace: Workspace,
  events: CashEvent[],
  baseline: CashflowResult,
  product: FinancingProduct,
): ProductEvaluation {
  const base: ProductEvaluation = {
    productId: product.id,
    productName: product.name,
    provider: product.provider,
    classification: product.classification,
    status: 'needs_information',
    reasons: [],
    missingEvidence: [],
    quote: null,
    disbursementDate: null,
    maturityDate: null,
    minClosingWithFinancingMinor: null,
    rank: null,
  };
  const gap = financingNeed(workspace, baseline);
  if (gap === 0n) return { ...base, status: 'does_not_fit', reasons: ['NO_FUNDING_GAP'] };

  const hard: ReasonCode[] = [];
  const info: ReasonCode[] = [];
  if (product.currency !== workspace.currency) hard.push('CURRENCY_MISMATCH');
  if (product.repaymentType !== SUPPORTED_REPAYMENT_TYPE) hard.push('UNSUPPORTED_COST_STRUCTURE');
  if (!product.eligibleBusinessTypes.includes(workspace.businessType)) hard.push('INELIGIBLE_BUSINESS_TYPE');
  if (!hasCompleteTerms(product)) info.push('MISSING_TERMS');
  const missingEvidence = product.requiredEvidence.filter((e) => !workspace.evidenceAvailable.includes(e));
  if (missingEvidence.length) info.push('MISSING_EVIDENCE');

  if (hard.length || !hasCompleteTerms(product)) {
    return { ...base, status: hard.length ? 'does_not_fit' : 'needs_information', reasons: [...hard, ...info], missingEvidence };
  }

  const principal = minimumPrincipal(product, gap);
  if (principal === null) {
    return { ...base, status: 'does_not_fit', reasons: ['FUNDING_CAP', ...info], missingEvidence };
  }
  const quote = quoteFor(product, principal);
  const disbursementDate = addDays(workspace.asOfDate, product.disbursementDelayDays);
  const maturityDate = addDays(disbursementDate, product.termDays!);
  const withDates = { ...base, quote, disbursementDate, maturityDate, missingEvidence };

  if (baseline.earliestNegativeDate !== null && disbursementDate > baseline.earliestNegativeDate) {
    return { ...withDates, status: 'does_not_fit', reasons: ['DELAYED_DISBURSEMENT', ...info] };
  }

  const projected = projectCashflow(workspace, events, [
    { id: `fin-${product.id}-in`, date: disbursementDate, direction: 'inflow', amountMinor: quote.netCashReceivedMinor, label: 'Modeled net disbursement' },
    { id: `fin-${product.id}-out`, date: maturityDate, direction: 'outflow', amountMinor: quote.maturityRepaymentMinor, label: 'Modeled maturity repayment' },
  ]);
  const minWith = projected.minClosingMinor;

  if (maturityDate > baseline.window.end) {
    return { ...withDates, minClosingWithFinancingMinor: minWith, status: 'needs_information', reasons: ['INCOMPLETE_HORIZON', ...info] };
  }
  if (toBig(minWith) < 0n) {
    return { ...withDates, minClosingWithFinancingMinor: minWith, status: 'does_not_fit', reasons: ['SHORTAGE_AFTER_REPAYMENT', ...info] };
  }
  if (info.length) {
    return { ...withDates, minClosingWithFinancingMinor: minWith, status: 'needs_information', reasons: info };
  }
  return { ...withDates, minClosingWithFinancingMinor: minWith, status: 'fits', reasons: [] };
}

const STATUS_ORDER: Record<FitStatus, number> = { fits: 0, needs_information: 1, does_not_fit: 2 };

export function compareFinancing(
  workspace: Workspace,
  events: CashEvent[],
  catalog: FinancingProduct[],
  catalogVersion: number,
  baseline: CashflowResult = projectCashflow(workspace, events),
): FinancingComparison {
  const evaluations = catalog.map((p) => evaluateProduct(workspace, events, baseline, p));
  evaluations.sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s !== 0) return s;
    if (a.status === 'fits' && b.status === 'fits' && a.quote && b.quote) {
      const c = toBig(a.quote.totalFinancingCostMinor) - toBig(b.quote.totalFinancingCostMinor);
      if (c !== 0n) return c < 0n ? -1 : 1;
      const r = toBig(a.quote.maturityRepaymentMinor) - toBig(b.quote.maturityRepaymentMinor);
      if (r !== 0n) return r < 0n ? -1 : 1;
    }
    return a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0;
  });
  let rank = 0;
  for (const e of evaluations) if (e.status === 'fits') e.rank = ++rank;
  const best = evaluations.find((e) => e.status === 'fits') ?? null;
  const notes: string[] = [];
  if (financingNeed(workspace, baseline) === 0n) notes.push(workspace.financingTarget === 'gap_plus_buffer' ? 'Cash stays above the minimum buffer in the window. There is no pressure to borrow.' : 'No funding gap is projected in the window. There is no pressure to borrow.');
  else if (!best) notes.push('No option fits the stated sandbox rules. Review reason codes or add missing information.');
  else notes.push(`${best.productName} has the lowest modeled cost among the comparable options provided.`);
  return {
    engineVersion: baseline.engineVersion,
    workspaceVersion: workspace.version,
    catalogVersion,
    fundingGapMinor: baseline.fundingGapMinor,
    requiredNetCashMinor: fromBig(financingNeed(workspace, baseline)),
    financingTarget: workspace.financingTarget,
    earliestNegativeDate: baseline.earliestNegativeDate,
    evaluations,
    bestFitProductId: best?.productId ?? null,
    assumptions: [...FINANCING_ASSUMPTIONS],
    notes,
  };
}
