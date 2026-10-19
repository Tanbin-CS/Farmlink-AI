import { formatBDT, type MoneyMinor } from './money';
import type { CivilDate } from './dates';
import type { CashflowResult } from './cashflow';
import type { ProductEvaluation, Quote } from './financing';
import type { CashEvent, FinancingProduct, Workspace } from './schemas';
import { payloadHash, randomId } from './hash';

export type ExecutionMode = 'guided_local' | 'live_cloud';

export const MODE_LABEL: Record<ExecutionMode, string> = {
  guided_local: 'Guided sandbox — no live AI',
  live_cloud: 'Live AI + sandbox tools',
};

export const RECEIPT_LABEL: Record<ExecutionMode, string> = {
  guided_local: 'Local sandbox receipt — browser only',
  live_cloud: 'Server sandbox receipt — FarmLink internal lender simulator',
};

export const DESTINATION = 'FarmLink internal lender simulator' as const;
export const ACTION_TTL_MS = 5 * 60 * 1000;

export type ApplicationStatus = 'DRAFT' | 'AWAITING_CONFIRMATION' | 'SANDBOX_SUBMITTED' | 'CANCELLED' | 'EXPIRED';

export interface SharedField {
  key: string;
  label: string;
  value: string;
}

export interface SandboxReceipt {
  receiptId: string;
  applicationId: string;
  status: 'SANDBOX_SUBMITTED';
  destination: typeof DESTINATION;
  submittedAt: string;
  mode: ExecutionMode;
  actionId: string;
  payloadHash: string;
  draftVersion: number;
  workspaceVersion: number;
  catalogVersion: number;
  idempotencyKey: string;
  label: string;
}

export interface ApplicationDraft {
  id: string;
  productId: string;
  productName: string;
  provider: string;
  classification: FinancingProduct['classification'];
  quote: Quote;
  disbursementDate: CivilDate;
  maturityDate: CivilDate;
  purpose: string;
  sharedRecordIds: string[];
  sharedFields: SharedField[];
  limitations: string[];
  workspaceVersion: number;
  catalogVersion: number;
  status: ApplicationStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: 'user' | 'model';
  pendingActionId: string | null;
  receipt: SandboxReceipt | null;
}

export interface SubmissionPayload {
  type: 'submit_sandbox_application';
  destination: typeof DESTINATION;
  applicationId: string;
  draftVersion: number;
  workspaceVersion: number;
  catalogVersion: number;
  productId: string;
  quote: Quote;
  disbursementDate: CivilDate;
  maturityDate: CivilDate;
  purpose: string;
  sharedFields: SharedField[];
  sharedRecordIds: string[];
}

export interface PendingAction {
  id: string;
  type: 'submit_sandbox_application';
  applicationId: string;
  payload: SubmissionPayload;
  payloadHash: string;
  nonce: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'consumed' | 'cancelled' | 'expired';
  createdBy: 'user' | 'model';
  idempotencyKey: string | null;
}

export interface ApprovalDecision {
  id: string;
  pendingActionId: string;
  applicationId: string;
  payloadHash: string;
  draftVersion: number;
  decision: 'confirmed' | 'cancelled';
  decidedAt: string;
  actionExpiresAt: string;
  resultRef: string | null;
  mode: ExecutionMode;
}

export type ToolPolicy = 'allowed' | 'rejected' | 'requires_confirmation' | 'error';

export interface ToolEvent {
  id: string;
  runId: string;
  seq: number;
  at: string;
  mode: ExecutionMode;
  actor: 'user' | 'guided' | 'model' | 'system';
  tool: string;
  args: Record<string, unknown>;
  policy: ToolPolicy;
  outcome: string;
  recordVersions?: { workspace?: number; draft?: number; catalog?: number };
}

export interface AgentRun {
  id: string;
  mode: ExecutionMode;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'completed' | 'awaiting_confirmation' | 'failed' | 'limit_reached';
  provider: string;
  modelId: string;
  userMessage: string;
  reply: string;
  roundTrips: number;
  toolCalls: number;
  pendingActionId: string | null;
  error: string | null;
}

export function sharedFieldsFor(
  workspace: Workspace,
  baseline: CashflowResult,
  quote: Quote,
  purpose: string,
  recordCount: number,
): SharedField[] {
  return [
    { key: 'businessName', label: 'Business name', value: workspace.businessName },
    { key: 'businessType', label: 'Business type', value: workspace.businessType },
    { key: 'analysisWindow', label: 'Forecast window', value: `${baseline.window.start} to ${baseline.window.end}` },
    { key: 'fundingGap', label: 'Projected funding gap', value: formatBDT(baseline.fundingGapMinor) },
    { key: 'earliestNegativeDate', label: 'First negative-cash date', value: baseline.earliestNegativeDate ?? 'none' },
    { key: 'requestedPrincipal', label: 'Requested principal', value: formatBDT(quote.principalMinor) },
    { key: 'purpose', label: 'Stated purpose', value: purpose },
    { key: 'recordCount', label: 'Cash records shared (IDs only)', value: String(recordCount) },
    { key: 'evidence', label: 'Evidence marked available', value: workspace.evidenceAvailable.join(', ') || 'none' },
  ];
}

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function buildDraft(input: {
  workspace: Workspace;
  events: CashEvent[];
  baseline: CashflowResult;
  evaluation: ProductEvaluation;
  product: FinancingProduct;
  catalogVersion: number;
  purpose: string;
  createdBy: 'user' | 'model';
  now: Date;
}): ApplicationDraft {
  const { workspace, baseline, evaluation, product } = input;
  if (evaluation.status !== 'fits' || !evaluation.quote || !evaluation.disbursementDate || !evaluation.maturityDate) {
    throw new DomainError('PRODUCT_NOT_FIT', 'Only options that fit the stated sandbox rules can be drafted.');
  }
  const purpose = input.purpose.trim().slice(0, 200) || 'Seasonal working capital to cover projected cash gap';
  const sharedRecordIds = input.events
    .filter((e) => e.status !== 'cancelled' && e.date >= baseline.window.start && e.date <= baseline.window.end)
    .map((e) => e.id)
    .sort();
  const ts = input.now.toISOString();
  return {
    id: randomId('app'),
    productId: product.id,
    productName: product.name,
    provider: product.provider,
    classification: product.classification,
    quote: evaluation.quote,
    disbursementDate: evaluation.disbursementDate,
    maturityDate: evaluation.maturityDate,
    purpose,
    sharedRecordIds,
    sharedFields: sharedFieldsFor(workspace, baseline, evaluation.quote, purpose, sharedRecordIds.length),
    limitations: product.limitations,
    workspaceVersion: workspace.version,
    catalogVersion: input.catalogVersion,
    status: 'DRAFT',
    version: 1,
    createdAt: ts,
    updatedAt: ts,
    createdBy: input.createdBy,
    pendingActionId: null,
    receipt: null,
  };
}

export function submissionPayload(draft: ApplicationDraft): SubmissionPayload {
  return {
    type: 'submit_sandbox_application',
    destination: DESTINATION,
    applicationId: draft.id,
    draftVersion: draft.version,
    workspaceVersion: draft.workspaceVersion,
    catalogVersion: draft.catalogVersion,
    productId: draft.productId,
    quote: draft.quote,
    disbursementDate: draft.disbursementDate,
    maturityDate: draft.maturityDate,
    purpose: draft.purpose,
    sharedFields: draft.sharedFields,
    sharedRecordIds: draft.sharedRecordIds,
  };
}

export function assertPreparable(draft: ApplicationDraft, currentWorkspaceVersion: number, currentCatalogVersion: number): void {
  if (draft.status === 'SANDBOX_SUBMITTED') throw new DomainError('ALREADY_SUBMITTED', 'This application was already submitted to the sandbox.', 409);
  if (draft.status === 'CANCELLED') throw new DomainError('APPLICATION_CANCELLED', 'This application was cancelled. Create a new draft.', 409);
  if (draft.workspaceVersion !== currentWorkspaceVersion || draft.catalogVersion !== currentCatalogVersion) {
    throw new DomainError('STALE_DRAFT', 'Records or catalog changed after this draft was created. Create a new draft.', 409);
  }
}

export async function preparePendingAction(draft: ApplicationDraft, createdBy: 'user' | 'model', now: Date): Promise<PendingAction> {
  const payload = submissionPayload(draft);
  return {
    id: randomId('act'),
    type: 'submit_sandbox_application',
    applicationId: draft.id,
    payload,
    payloadHash: await payloadHash(payload),
    nonce: randomId('n', 16),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ACTION_TTL_MS).toISOString(),
    status: 'pending',
    createdBy,
    idempotencyKey: null,
  };
}

/**
 * Re-derives the payload from the stored draft and checks every binding. Never trusts
 * client-provided flags or hashes.
 */
export async function verifyConfirmation(input: {
  action: PendingAction;
  draft: ApplicationDraft;
  currentWorkspaceVersion: number;
  currentCatalogVersion: number;
  now: Date;
}): Promise<void> {
  const { action, draft, now } = input;
  if (action.status !== 'pending') throw new DomainError('ACTION_NOT_PENDING', `This action is ${action.status}.`, 409);
  if (now.getTime() > Date.parse(action.expiresAt)) throw new DomainError('ACTION_EXPIRED', 'This confirmation expired. Prepare the submission again.', 409);
  if (draft.id !== action.applicationId) throw new DomainError('ACTION_MISMATCH', 'Action does not belong to this application.', 409);
  if (draft.status !== 'AWAITING_CONFIRMATION' || draft.pendingActionId !== action.id) {
    throw new DomainError('STALE_ACTION', 'The application changed after review. Review again.', 409);
  }
  if (draft.workspaceVersion !== input.currentWorkspaceVersion || draft.catalogVersion !== input.currentCatalogVersion) {
    throw new DomainError('STALE_DRAFT', 'Records or catalog changed after review. Create a new draft.', 409);
  }
  const recomputed = await payloadHash(submissionPayload(draft));
  if (recomputed !== action.payloadHash) throw new DomainError('PAYLOAD_MISMATCH', 'Reviewed payload no longer matches the draft.', 409);
}

export function buildReceipt(input: {
  draft: ApplicationDraft;
  action: PendingAction;
  mode: ExecutionMode;
  idempotencyKey: string;
  now: Date;
}): SandboxReceipt {
  return {
    receiptId: randomId('rcpt'),
    applicationId: input.draft.id,
    status: 'SANDBOX_SUBMITTED',
    destination: DESTINATION,
    submittedAt: input.now.toISOString(),
    mode: input.mode,
    actionId: input.action.id,
    payloadHash: input.action.payloadHash,
    draftVersion: input.draft.version,
    workspaceVersion: input.draft.workspaceVersion,
    catalogVersion: input.draft.catalogVersion,
    idempotencyKey: input.idempotencyKey,
    label: RECEIPT_LABEL[input.mode],
  };
}

/** Redact argument values that could carry secrets or bulky text before logging. */
export function sanitizeArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args as Record<string, unknown>).slice(0, 12)) {
    if (/token|key|secret|password|authorization/i.test(k)) out[k] = '[redacted]';
    else if (typeof v === 'string') out[k] = v.length > 120 ? `${v.slice(0, 120)}…` : v;
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = v;
    else out[k] = '[structured]';
  }
  return out;
}

export interface EvidenceBundle {
  kind: 'farmlink-execution-evidence';
  schemaVersion: 1;
  generatedAt: string;
  mode: ExecutionMode;
  modeLabel: string;
  build: { frontendSha: string | null; backendSha: string | null; engineVersion: string };
  provider: { name: string; modelId: string } | null;
  workspace: { id: string; businessName: string; businessType: string; asOfDate: string; forecastDays: number; version: number; provenance: string; eventCount: number };
  applications: ApplicationDraft[];
  pendingActions: PendingAction[];
  approvals: ApprovalDecision[];
  runs: AgentRun[];
  toolEvents: ToolEvent[];
  truthLabels: string[];
  reproduction: string[];
  contentHash: string;
}

export const TRUTH_LABELS = {
  prototype: 'Competition prototype. Sandbox only. No real loan, payment, or lender submission.',
  cashflow: 'Cash-flow estimates depend on the records and assumptions provided.',
  financing: 'Financing comparison is informational, not a loan approval or guarantee.',
  input: 'Do not enter real identity documents, passwords, payment credentials, or confidential records.',
  localLogs: 'Local logs can be edited by the browser user.',
  serverLogs: 'Server logs are application records, not blockchain or tamper-proof evidence.',
} as const;

export async function buildEvidenceBundle(input: Omit<EvidenceBundle, 'kind' | 'schemaVersion' | 'contentHash' | 'modeLabel' | 'truthLabels' | 'reproduction'> & { redactBusinessName?: boolean }): Promise<EvidenceBundle> {
  const { redactBusinessName, ...rest } = input;
  const workspace = redactBusinessName ? { ...rest.workspace, businessName: '[redacted]' } : rest.workspace;
  const applications = redactBusinessName
    ? rest.applications.map((a) => ({ ...a, sharedFields: a.sharedFields.map((f) => (f.key === 'businessName' ? { ...f, value: '[redacted]' } : f)) }))
    : rest.applications;
  const body = {
    kind: 'farmlink-execution-evidence' as const,
    schemaVersion: 1 as const,
    ...rest,
    workspace,
    applications,
    modeLabel: MODE_LABEL[rest.mode],
    truthLabels: [
      TRUTH_LABELS.prototype,
      rest.mode === 'guided_local' ? TRUTH_LABELS.localLogs : TRUTH_LABELS.serverLogs,
      'The content hash is an integrity aid for this export, not an independent attestation.',
    ],
    reproduction: [
      'Open the public site, choose the same mode, and load the sandbox demo scenario (or import the same records).',
      'Run Analyze cash flow, Compare financing, Prepare application, then review and confirm the sandbox submission.',
      'Financial outputs are deterministic for identical records, catalog, and engine version.',
    ],
  };
  return { ...body, contentHash: await payloadHash(body) };
}

export function moneyLabel(v: MoneyMinor): string {
  return formatBDT(v);
}
