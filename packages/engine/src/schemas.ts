import { z } from 'zod';
import { isMoneyMinor } from './money';
import { isCivilDate } from './dates';

export const SCHEMA_VERSION = 1 as const;

export const LIMITS = {
  maxEventsPerWorkspace: 1000,
  maxImportBytes: 1024 * 1024,
  maxDescriptionLength: 280,
  maxSourceRefLength: 120,
  maxBusinessNameLength: 80,
  maxProductsInCatalog: 50,
} as const;

export const moneyMinor = z.string().refine(isMoneyMinor, 'Invalid money amount (integer minor units, bounded)');
export const nonNegativeMoney = moneyMinor.refine((v) => !v.startsWith('-'), 'Amount must not be negative');
export const positiveMoney = moneyMinor.refine((v) => !v.startsWith('-') && v !== '0', 'Amount must be positive');
export const civilDate = z.string().refine(isCivilDate, 'Invalid calendar date (YYYY-MM-DD)');
const safeId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'IDs use letters, digits, - and _ only (max 64)');
const plainText = (max: number) =>
  z
    .string()
    .max(max)
    // Strip control characters; content is always rendered as text, never HTML.
    // eslint-disable-next-line no-control-regex
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''));

export const BusinessType = z.enum(['cooperative', 'agribusiness']);
export type BusinessType = z.infer<typeof BusinessType>;

export const EVIDENCE_TYPES = [
  'sales_records',
  'purchase_order',
  'cooperative_registration',
  'trade_license',
  'bank_statement',
  'member_list',
] as const;
export const EvidenceType = z.enum(EVIDENCE_TYPES);
export type EvidenceType = z.infer<typeof EvidenceType>;

export const Provenance = z.enum(['owner_entered', 'redacted_example', 'sandbox_fixture']);

export const WorkspaceSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: safeId,
  businessName: plainText(LIMITS.maxBusinessNameLength).pipe(z.string().min(1, 'Business name is required')),
  businessType: BusinessType,
  currency: z.literal('BDT'),
  asOfDate: civilDate,
  openingCashMinor: moneyMinor,
  minimumCashBufferMinor: nonNegativeMoney,
  forecastDays: z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(120)]),
  evidenceAvailable: z.array(EvidenceType).max(EVIDENCE_TYPES.length),
  version: z.number().int().nonnegative(),
  provenance: Provenance,
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const CashEventSchema = z.object({
  id: safeId,
  direction: z.enum(['inflow', 'outflow']),
  category: z.enum(['sales_receipt', 'input_cost', 'transport', 'operating_cost', 'debt_repayment', 'other']),
  amountMinor: positiveMoney,
  date: civilDate,
  status: z.enum(['planned', 'settled', 'cancelled']),
  description: plainText(LIMITS.maxDescriptionLength),
  sourceRef: plainText(LIMITS.maxSourceRefLength),
  version: z.number().int().nonnegative(),
});
export type CashEvent = z.infer<typeof CashEventSchema>;
export type CashEventCategory = CashEvent['category'];

export const FinancingProductSchema = z.object({
  id: safeId,
  name: plainText(80).pipe(z.string().min(1)),
  provider: plainText(80).pipe(z.string().min(1)),
  classification: z.enum(['sandbox_product', 'public_reference']),
  sourceUrl: z.string().url().max(300).optional(),
  retrievedAt: civilDate.optional(),
  currency: z.literal('BDT'),
  principalMinMinor: positiveMoney,
  principalMaxMinor: positiveMoney,
  /** null = unknown. Unknown terms are never treated as zero. */
  annualSimpleRateBps: z.number().int().min(0).max(10_000).nullable(),
  upfrontFeeBps: z.number().int().min(0).max(5_000).nullable(),
  upfrontFixedFeeMinor: nonNegativeMoney.nullable(),
  termDays: z.number().int().min(1).max(730).nullable(),
  disbursementDelayDays: z.number().int().min(0).max(180),
  repaymentType: z.string().max(40),
  eligibleBusinessTypes: z.array(BusinessType).min(1),
  requiredEvidence: z.array(EvidenceType),
  limitations: z.array(plainText(200)).max(10),
});
export type FinancingProduct = z.infer<typeof FinancingProductSchema>;

export const SUPPORTED_REPAYMENT_TYPE = 'simple_interest_bullet';

export const WorkspaceBundleSchema = z.object({
  workspace: WorkspaceSchema,
  events: z.array(CashEventSchema).max(LIMITS.maxEventsPerWorkspace),
  catalog: z.array(FinancingProductSchema).max(LIMITS.maxProductsInCatalog),
  catalogVersion: z.number().int().nonnegative(),
});
export type WorkspaceBundle = z.infer<typeof WorkspaceBundleSchema>;

/** Returns issues such as duplicate IDs that a per-item schema cannot see. */
export function validateBundle(bundle: unknown):
  | { ok: true; value: WorkspaceBundle }
  | { ok: false; issues: string[] } {
  const parsed = WorkspaceBundleSchema.safeParse(bundle);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const e of parsed.data.events) {
    if (seen.has(e.id)) issues.push(`events: duplicate event id ${e.id}`);
    seen.add(e.id);
  }
  const seenP = new Set<string>();
  for (const p of parsed.data.catalog) {
    if (seenP.has(p.id)) issues.push(`catalog: duplicate product id ${p.id}`);
    seenP.add(p.id);
    if (BigInt(p.principalMinMinor) > BigInt(p.principalMaxMinor)) {
      issues.push(`catalog.${p.id}: principal minimum exceeds maximum`);
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: parsed.data };
}
