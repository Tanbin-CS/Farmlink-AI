import { addDays, type CivilDate } from './dates';
import { SCHEMA_VERSION, type CashEvent, type FinancingProduct, type Workspace } from './schemas';
import type { CurrencyCode } from './money';

/**
 * Sandbox fixture. Every name, amount, rate, and record below is fictional software test
 * input. It is NOT field data about Bangladesh farms and NOT any real lender's offer.
 */
export const DEMO_DISCLAIMER =
  'Fictional sandbox fixture: the cooperative, records, lenders, and rates are invented software inputs, not real offers or field data.';

export const DEMO_CATALOG_VERSION = 1;

/**
 * The fictional scenario is authored in BDT. USD and EUR variants divide every whole-unit
 * amount by a fixed round factor so the same story reads naturally for international reviewers.
 * The factors are scenario-authoring choices, not exchange rates.
 */
const DEMO_FACTOR: Record<CurrencyCode, number> = { BDT: 1, USD: 125, EUR: 140 };

/** Whole BDT amount -> minor units of the demo currency. */
function demoMinor(bdt: number, currency: CurrencyCode): string {
  return String(Math.round(bdt / DEMO_FACTOR[currency]) * 100);
}

export function demoWorkspace(asOfDate: CivilDate, id = 'ws_demo', currency: CurrencyCode = 'BDT'): Workspace {
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    businessName: 'Sandbox Demo Cooperative (fictional)',
    businessType: 'cooperative',
    currency,
    asOfDate,
    openingCashMinor: demoMinor(350_000, currency),
    minimumCashBufferMinor: demoMinor(100_000, currency),
    forecastDays: 90,
    evidenceAvailable: ['sales_records', 'purchase_order', 'cooperative_registration', 'trade_license'],
    financingTarget: 'gap',
    version: 1,
    provenance: 'sandbox_fixture',
  };
}

type Row = [offset: number, id: string, direction: CashEvent['direction'], category: CashEvent['category'], bdt: number, status: CashEvent['status'], description: string, sourceRef: string];

const ROWS: Row[] = [
  [-5, 'ev-001', 'inflow', 'sales_receipt', 80_000, 'settled', 'Vegetable sales to local market (already in opening cash)', 'Ledger p.3 (fictional)'],
  [-3, 'ev-002', 'outflow', 'transport', 12_000, 'planned', 'Truck hire for input pickup (overdue, not yet paid)', 'Invoice T-114 (fictional)'],
  [3, 'ev-003', 'outflow', 'operating_cost', 60_000, 'planned', 'Field worker wages, fortnight 1', 'Payroll sheet W1 (fictional)'],
  [7, 'ev-004', 'outflow', 'input_cost', 420_000, 'planned', 'Boro rice seed and seedling purchase for members', 'PO-SANDBOX-0007'],
  [10, 'ev-005', 'outflow', 'input_cost', 180_000, 'planned', 'Fertilizer purchase (urea, TSP)', 'PO-SANDBOX-0008'],
  [20, 'ev-006', 'outflow', 'operating_cost', 60_000, 'planned', 'Field worker wages, fortnight 2', 'Payroll sheet W2 (fictional)'],
  [25, 'ev-007', 'inflow', 'sales_receipt', 90_000, 'planned', 'Winter vegetable sales', 'Buyer note B-21 (fictional)'],
  [30, 'ev-008', 'outflow', 'other', 50_000, 'cancelled', 'Storage shed repair (postponed)', 'Quote Q-9 (fictional)'],
  [35, 'ev-009', 'outflow', 'operating_cost', 60_000, 'planned', 'Field worker wages, fortnight 3', 'Payroll sheet W3 (fictional)'],
  [40, 'ev-010', 'outflow', 'transport', 25_000, 'planned', 'Irrigation pump fuel and transport', 'Invoice T-131 (fictional)'],
  [50, 'ev-011', 'outflow', 'operating_cost', 60_000, 'planned', 'Field worker wages, fortnight 4', 'Payroll sheet W4 (fictional)'],
  [58, 'ev-012', 'inflow', 'sales_receipt', 650_000, 'planned', 'Harvest sale, first lot (purchase order from sandbox buyer)', 'PO-BUYER-SANDBOX-0058'],
  [65, 'ev-013', 'outflow', 'operating_cost', 60_000, 'planned', 'Field worker wages, fortnight 5', 'Payroll sheet W5 (fictional)'],
  [72, 'ev-014', 'inflow', 'sales_receipt', 520_000, 'planned', 'Harvest sale, second lot', 'PO-BUYER-SANDBOX-0072'],
  [80, 'ev-015', 'outflow', 'operating_cost', 60_000, 'planned', 'Field worker wages, fortnight 6', 'Payroll sheet W6 (fictional)'],
  [95, 'ev-016', 'inflow', 'sales_receipt', 150_000, 'planned', 'Straw and by-product sales (after forecast window)', 'Buyer note B-40 (fictional)'],
];

export function demoEvents(asOfDate: CivilDate, currency: CurrencyCode = 'BDT'): CashEvent[] {
  return ROWS.map(([offset, id, direction, category, bdt, status, description, sourceRef]) => ({
    id,
    direction,
    category,
    amountMinor: demoMinor(bdt, currency),
    date: addDays(asOfDate, offset),
    status,
    description,
    sourceRef,
    version: 1,
  }));
}

const base = {
  classification: 'sandbox_product' as const,
  currency: 'BDT' as CurrencyCode,
  repaymentType: 'simple_interest_bullet',
  eligibleBusinessTypes: ['cooperative', 'agribusiness'] as FinancingProduct['eligibleBusinessTypes'],
};

export function demoCatalog(currency: CurrencyCode = 'BDT'): FinancingProduct[] {
  const bdtCatalog: FinancingProduct[] = [
    {
      ...base,
      id: 'sbx-seasonal-a',
      name: 'Seasonal Crop Line A',
      provider: 'Sandbox Lender Alpha (fictional)',
      principalMinMinor: '5000000',
      principalMaxMinor: '100000000',
      annualSimpleRateBps: 1100,
      upfrontFeeBps: 100,
      upfrontFixedFeeMinor: '50000',
      termDays: 75,
      disbursementDelayDays: 2,
      requiredEvidence: ['sales_records', 'purchase_order'],
      limitations: ['Fictional sandbox terms for software testing only.'],
    },
    {
      ...base,
      id: 'sbx-working-b',
      name: 'Agri Working Capital B',
      provider: 'Sandbox Lender Beta (fictional)',
      principalMinMinor: '10000000',
      principalMaxMinor: '80000000',
      annualSimpleRateBps: 900,
      upfrontFeeBps: 200,
      upfrontFixedFeeMinor: '0',
      termDays: 60,
      disbursementDelayDays: 5,
      requiredEvidence: ['sales_records', 'trade_license'],
      limitations: ['Fictional sandbox terms for software testing only.'],
    },
    {
      ...base,
      id: 'sbx-supplier-c',
      name: 'Input Supplier Credit C',
      provider: 'Sandbox Lender Gamma (fictional)',
      principalMinMinor: '5000000',
      principalMaxMinor: '100000000',
      annualSimpleRateBps: 800,
      upfrontFeeBps: 50,
      upfrontFixedFeeMinor: '0',
      termDays: 60,
      disbursementDelayDays: 10,
      requiredEvidence: ['purchase_order'],
      limitations: ['Disbursement takes 10 days in this sandbox scenario.'],
    },
    {
      ...base,
      id: 'sbx-short-d',
      name: 'Short Bridge Loan D',
      provider: 'Sandbox Lender Delta (fictional)',
      principalMinMinor: '5000000',
      principalMaxMinor: '200000000',
      annualSimpleRateBps: 1400,
      upfrontFeeBps: 100,
      upfrontFixedFeeMinor: '0',
      termDays: 30,
      disbursementDelayDays: 1,
      requiredEvidence: ['sales_records'],
      limitations: ['30-day term: matures before harvest receipts in this scenario.'],
    },
    {
      ...base,
      id: 'sbx-harvest-e',
      name: 'Harvest Loan E',
      provider: 'Sandbox Lender Epsilon (fictional)',
      principalMinMinor: '5000000',
      principalMaxMinor: '100000000',
      annualSimpleRateBps: 1000,
      upfrontFeeBps: 100,
      upfrontFixedFeeMinor: '0',
      termDays: 120,
      disbursementDelayDays: 2,
      requiredEvidence: ['sales_records'],
      limitations: ['120-day term extends beyond a 90-day forecast window.'],
    },
    {
      ...base,
      id: 'sbx-template-f',
      name: 'Template F (fee unknown)',
      provider: 'Sandbox Lender Zeta (fictional)',
      principalMinMinor: '5000000',
      principalMaxMinor: '100000000',
      annualSimpleRateBps: 950,
      upfrontFeeBps: null,
      upfrontFixedFeeMinor: null,
      termDays: 75,
      disbursementDelayDays: 3,
      requiredEvidence: ['sales_records'],
      limitations: ['Fee terms not supplied; cannot be costed until completed.'],
    },
    {
      ...base,
      id: 'sbx-group-g',
      name: 'Cooperative Group Loan G',
      provider: 'Sandbox Lender Eta (fictional)',
      eligibleBusinessTypes: ['cooperative'],
      principalMinMinor: '5000000',
      principalMaxMinor: '30000000',
      annualSimpleRateBps: 700,
      upfrontFeeBps: 50,
      upfrontFixedFeeMinor: '0',
      termDays: 75,
      disbursementDelayDays: 2,
      requiredEvidence: ['cooperative_registration', 'member_list'],
      limitations: ['Maximum principal BDT 300,000 in this sandbox scenario.'],
    },
    {
      ...base,
      id: 'sbx-installment-h',
      name: 'Monthly Installment Loan H',
      provider: 'Sandbox Lender Theta (fictional)',
      principalMinMinor: '5000000',
      principalMaxMinor: '100000000',
      annualSimpleRateBps: 1200,
      upfrontFeeBps: 100,
      upfrontFixedFeeMinor: '0',
      termDays: 180,
      disbursementDelayDays: 2,
      repaymentType: 'reducing_balance_monthly',
      requiredEvidence: ['sales_records'],
      limitations: ['Reducing-balance installments are not modeled by this prototype.'],
    },
  ];
  if (currency === 'BDT') return bdtCatalog;
  const conv = (minor: string | null) => (minor === null ? null : demoMinor(Number(BigInt(minor) / 100n), currency));
  return bdtCatalog.map((p) => ({
    ...p,
    currency,
    principalMinMinor: conv(p.principalMinMinor)!,
    principalMaxMinor: conv(p.principalMaxMinor)!,
    upfrontFixedFeeMinor: conv(p.upfrontFixedFeeMinor),
    limitations: p.limitations.map((l) => l.replace('BDT 300,000', `${currency} ${(300_000 / DEMO_FACTOR[currency]).toLocaleString('en-US', { maximumFractionDigits: 0 })}`)),
  }));
}
