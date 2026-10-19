import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareFinancing,
  demoCatalog,
  demoEvents,
  demoWorkspace,
  diffDays,
  divRoundHalfUp,
  eventsToCsv,
  formatBDT,
  isCivilDate,
  isMoneyMinor,
  minimumPrincipal,
  parseMajor,
  projectCashflow,
  quoteFor,
  validateBundle,
  validateCsvRows,
  canonicalJson,
  type CashEvent,
  type FinancingProduct,
  type Workspace,
} from '../src';

const AS_OF = '2026-10-20';

function ws(over: Partial<Workspace> = {}): Workspace {
  return { ...demoWorkspace(AS_OF), ...over };
}

function ev(id: string, offset: number, direction: CashEvent['direction'], bdt: number, status: CashEvent['status'] = 'planned'): CashEvent {
  return {
    id,
    direction,
    category: direction === 'inflow' ? 'sales_receipt' : 'input_cost',
    amountMinor: String(bdt * 100),
    date: addDays(AS_OF, offset),
    status,
    description: '',
    sourceRef: 'test',
    version: 1,
  };
}

describe('money', () => {
  it('parses major units exactly and rejects invalid input', () => {
    expect(parseMajor('12,500.5')).toBe('1250050');
    expect(parseMajor('0.01')).toBe('1');
    expect(() => parseMajor('1.234')).toThrow();
    expect(() => parseMajor('1e5')).toThrow();
    expect(() => parseMajor('-5')).toThrow();
    expect(parseMajor('-5', { allowNegative: true })).toBe('-500');
    expect(() => parseMajor('9999999999999999')).toThrow();
  });
  it('rounds half up with integer arithmetic', () => {
    expect(divRoundHalfUp(5n, 10n)).toBe(1n);
    expect(divRoundHalfUp(4n, 10n)).toBe(0n);
    expect(divRoundHalfUp(15n, 10n)).toBe(2n);
    expect(divRoundHalfUp(25n, 10n)).toBe(3n);
  });
  it('formats with lakh grouping', () => {
    expect(formatBDT('123456789')).toBe('BDT 12,34,567.89');
    expect(formatBDT('-50000')).toBe('-BDT 500.00');
  });
  it('rejects oversized and malformed minor strings', () => {
    expect(isMoneyMinor('100')).toBe(true);
    expect(isMoneyMinor('1.5')).toBe(false);
    expect(isMoneyMinor('-0')).toBe(false);
    expect(isMoneyMinor('0100')).toBe(false);
    expect(isMoneyMinor('1000000000000000000')).toBe(false);
  });
});

describe('dates', () => {
  it('validates civil dates and does calendar arithmetic without time zones', () => {
    expect(isCivilDate('2028-02-29')).toBe(true);
    expect(isCivilDate('2026-02-29')).toBe(false);
    expect(isCivilDate('2026-13-01')).toBe(false);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(diffDays('2026-10-20', '2027-01-18')).toBe(90);
  });
});

describe('cash-flow engine', () => {
  it('empty workspace: only opening cash, no gap, warns about missing records', () => {
    const r = projectCashflow(ws(), []);
    expect(r.days).toHaveLength(90);
    expect(r.fundingGapMinor).toBe('0');
    expect(r.earliestNegativeDate).toBeNull();
    expect(r.warnings.join(' ')).toMatch(/No cash events/);
  });

  it('no negative forecast gives zero funding gap', () => {
    const r = projectCashflow(ws(), [ev('a', 1, 'inflow', 1000), ev('b', 2, 'outflow', 500)]);
    expect(r.fundingGapMinor).toBe('0');
    expect(r.totals.netMinor).toBe('50000');
  });

  it('known dated shortfall: earliest date and cumulative gap are exact', () => {
    const r = projectCashflow(ws({ openingCashMinor: '100000' }), [
      ev('a', 3, 'outflow', 1500),
      ev('b', 5, 'outflow', 1000),
      ev('c', 9, 'inflow', 5000),
    ]);
    expect(r.earliestNegativeDate).toBe(addDays(AS_OF, 3));
    expect(r.minClosingMinor).toBe('-150000');
    expect(r.minClosingDate).toBe(addDays(AS_OF, 5));
    expect(r.fundingGapMinor).toBe('150000');
    expect(r.alerts.filter((a) => a.level === 'critical')).toHaveLength(6);
  });

  it('excludes cancelled, past, and after-window events exactly once; lists overdue planned events', () => {
    const r = projectCashflow(ws({ openingCashMinor: '0', minimumCashBufferMinor: '0' }), [
      ev('cancel', 2, 'outflow', 999, 'cancelled'),
      ev('settled-past', -2, 'inflow', 500, 'settled'),
      ev('overdue', -1, 'outflow', 300, 'planned'),
      ev('later', 200, 'outflow', 100),
      ev('in', 0, 'inflow', 10),
    ]);
    expect(r.counts).toEqual({ included: 1, cancelled: 1, settledBeforeWindow: 1, afterWindow: 1, overdue: 1 });
    expect(r.overduePlanned.map((o) => o.id)).toEqual(['overdue']);
    expect(r.totals.endingCashMinor).toBe('1000');
  });

  it('does not double-count historical cash in the opening balance', () => {
    const r = projectCashflow(ws({ openingCashMinor: '500000' }), [ev('past', -10, 'inflow', 5000, 'settled')]);
    expect(r.days[0]!.closingMinor).toBe('500000');
  });

  it('nets same-day inflow and outflow and keeps planned/settled components', () => {
    const r = projectCashflow(ws({ openingCashMinor: '0', minimumCashBufferMinor: '0' }), [
      ev('i', 0, 'inflow', 100, 'settled'),
      ev('o', 0, 'outflow', 100, 'planned'),
    ]);
    expect(r.days[0]!.closingMinor).toBe('0');
    expect(r.days[0]!.inflowSettledMinor).toBe('10000');
    expect(r.days[0]!.outflowPlannedMinor).toBe('10000');
  });

  it('rejects duplicate IDs', () => {
    expect(() => projectCashflow(ws(), [ev('x', 1, 'inflow', 1), ev('x', 2, 'inflow', 1)])).toThrow(/Duplicate/);
  });
});

function product(over: Partial<FinancingProduct> = {}): FinancingProduct {
  return { ...demoCatalog()[0]!, ...over };
}

describe('financing engine', () => {
  it('computes fee, interest, net proceeds with exact half-up rounding', () => {
    const q = quoteFor(product({ annualSimpleRateBps: 1100, upfrontFeeBps: 100, upfrontFixedFeeMinor: '50000', termDays: 75 }), 42_979_800n);
    expect(q.feeMinor).toBe(String(50_000n + 429_798n));
    // 42,979,800 * 1100 * 75 / 3,650,000 = 971,461.23... -> 971,461
    expect(q.interestMinor).toBe('971461');
    expect(BigInt(q.netCashReceivedMinor)).toBe(42_979_800n - 479_798n);
    expect(q.maturityRepaymentMinor).toBe(String(42_979_800n + 971_461n));
  });

  it('finds the minimum principal whose net proceeds cover the gap', () => {
    const p = product();
    const need = 42_500_000n;
    const principal = minimumPrincipal(p, need)!;
    expect(BigInt(quoteFor(p, principal).netCashReceivedMinor) >= need).toBe(true);
    expect(BigInt(quoteFor(p, principal - 1n).netCashReceivedMinor) < need).toBe(true);
  });

  it('fees reduce net proceeds: principal exceeds the gap when fees exist', () => {
    const p = product({ upfrontFeeBps: 200, upfrontFixedFeeMinor: '0' });
    const principal = minimumPrincipal(p, 10_000_000n)!;
    expect(principal > 10_000_000n).toBe(true);
  });

  it('demo scenario produces each documented outcome', () => {
    const w = demoWorkspace(AS_OF);
    const cmp = compareFinancing(w, demoEvents(AS_OF), demoCatalog(), 1);
    const byId = Object.fromEntries(cmp.evaluations.map((e) => [e.productId, e]));
    expect(cmp.fundingGapMinor).toBe('42500000');
    expect(cmp.earliestNegativeDate).toBe(addDays(AS_OF, 7));
    expect(byId['sbx-seasonal-a']!.status).toBe('fits');
    expect(byId['sbx-working-b']!.status).toBe('fits');
    expect(byId['sbx-supplier-c']!.reasons).toContain('DELAYED_DISBURSEMENT');
    expect(byId['sbx-short-d']!.reasons).toContain('SHORTAGE_AFTER_REPAYMENT');
    expect(byId['sbx-harvest-e']!.reasons).toContain('INCOMPLETE_HORIZON');
    expect(byId['sbx-harvest-e']!.status).toBe('needs_information');
    expect(byId['sbx-template-f']!.reasons).toContain('MISSING_TERMS');
    expect(byId['sbx-template-f']!.quote).toBeNull();
    expect(byId['sbx-group-g']!.reasons).toContain('FUNDING_CAP');
    expect(byId['sbx-installment-h']!.reasons).toContain('UNSUPPORTED_COST_STRUCTURE');
    expect(cmp.bestFitProductId).toBe('sbx-seasonal-a');
    expect(byId['sbx-seasonal-a']!.rank).toBe(1);
    expect(byId['sbx-working-b']!.rank).toBe(2);
    expect(cmp.evaluations[0]!.productId).toBe('sbx-seasonal-a');
  });

  it('delayed disbursement cannot cover an earlier deficit', () => {
    const w = ws({ openingCashMinor: '0', minimumCashBufferMinor: '0' });
    const cmp = compareFinancing(w, [ev('o', 1, 'outflow', 1000), ev('i', 40, 'inflow', 5000)], [product({ disbursementDelayDays: 5 })], 1);
    expect(cmp.evaluations[0]!.status).toBe('does_not_fit');
    expect(cmp.evaluations[0]!.reasons).toEqual(['DELAYED_DISBURSEMENT']);
  });

  it('no funding gap: nothing fits and there is no pressure to borrow', () => {
    const cmp = compareFinancing(ws(), [], demoCatalog(), 1);
    expect(cmp.bestFitProductId).toBeNull();
    expect(cmp.evaluations.every((e) => e.reasons.includes('NO_FUNDING_GAP'))).toBe(true);
    expect(cmp.notes[0]).toMatch(/no pressure to borrow/);
  });

  it('missing evidence is needs_information, never eligible', () => {
    const w = ws({ evidenceAvailable: [] });
    const cmp = compareFinancing(w, demoEvents(AS_OF), [product()], 1);
    expect(cmp.evaluations[0]!.status).toBe('needs_information');
    expect(cmp.evaluations[0]!.missingEvidence).toEqual(['sales_records', 'purchase_order']);
  });

  it('is deterministic for identical inputs', () => {
    const a = compareFinancing(demoWorkspace(AS_OF), demoEvents(AS_OF), demoCatalog(), 1);
    const b = compareFinancing(demoWorkspace(AS_OF), demoEvents(AS_OF), demoCatalog(), 1);
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });
});

describe('validation and CSV', () => {
  it('validates the demo bundle and flags duplicates', () => {
    const bundle = { workspace: demoWorkspace(AS_OF), events: demoEvents(AS_OF), catalog: demoCatalog(), catalogVersion: 1 };
    expect(validateBundle(bundle).ok).toBe(true);
    const dup = { ...bundle, events: [...bundle.events, bundle.events[0]] };
    const res = validateBundle(dup);
    expect(res.ok).toBe(false);
  });

  it('rejects invalid CSV money, dates, direction, and status as a batch', () => {
    const res = validateCsvRows([
      { id: 'a', direction: 'inflow', category: 'sales_receipt', amount_bdt: '100.50', date: '2026-10-21', status: 'planned', description: 'ok', source_ref: 'r' },
      { id: 'b', direction: 'sideways', category: 'sales_receipt', amount_bdt: '1', date: '2026-10-21', status: 'planned', description: '', source_ref: '' },
      { id: 'c', direction: 'inflow', category: 'sales_receipt', amount_bdt: '1.999', date: '2026-10-21', status: 'planned', description: '', source_ref: '' },
      { id: 'd', direction: 'inflow', category: 'sales_receipt', amount_bdt: '1', date: '2026-02-30', status: 'planned', description: '', source_ref: '' },
      { id: 'a', direction: 'inflow', category: 'sales_receipt', amount_bdt: '1', date: '2026-10-21', status: 'planned', description: '', source_ref: '' },
    ]);
    expect(res.events.map((e) => e.id)).toEqual(['a']);
    expect(res.events[0]!.amountMinor).toBe('10050');
    expect(res.errors.map((e) => e.row)).toEqual([3, 4, 5, 6]);
    expect(res.duplicateIds).toEqual(['a']);
  });

  it('neutralizes spreadsheet formula injection on export', () => {
    const csv = eventsToCsv([{ ...ev('x', 1, 'inflow', 1), description: '=HYPERLINK("http://evil")' }]);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
  });
});
