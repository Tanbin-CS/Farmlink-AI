import type {
  AgentRun,
  ApplicationDraft,
  ApprovalDecision,
  CashEvent,
  CashflowResult,
  CurrencyCode,
  EvidenceBundle,
  ExecutionMode,
  FinancingComparison,
  FinancingProduct,
  PendingAction,
  SandboxReceipt,
  StressReport,
  ToolEvent,
  Workspace,
} from '@farmlink/engine';

export interface SandboxSnapshot {
  mode: ExecutionMode;
  workspace: Workspace | null;
  events: CashEvent[];
  catalog: FinancingProduct[];
  catalogVersion: number;
  applications: ApplicationDraft[];
  actions: PendingAction[];
  approvals: ApprovalDecision[];
  runs: AgentRun[];
  toolEvents: ToolEvent[];
}

export interface AgentTurnResult {
  run: AgentRun;
  toolEvents: ToolEvent[];
  pendingAction: PendingAction | null;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * One UI-facing service interface, two implementations: LocalSandboxClient (browser-only,
 * guided mode) and CloudSandboxClient (live API). Every receipt and export carries the mode.
 */
export interface SandboxClient {
  readonly mode: ExecutionMode;
  load(): Promise<SandboxSnapshot>;
  saveWorkspace(workspace: Workspace): Promise<SandboxSnapshot>;
  upsertEvent(event: CashEvent): Promise<SandboxSnapshot>;
  deleteEvent(id: string): Promise<SandboxSnapshot>;
  importEvents(events: CashEvent[]): Promise<SandboxSnapshot>;
  saveCatalog(catalog: FinancingProduct[]): Promise<SandboxSnapshot>;
  loadDemo(currency?: CurrencyCode): Promise<SandboxSnapshot>;
  analyzeCashflow(actor: 'user' | 'guided'): Promise<CashflowResult>;
  compareFinancing(actor: 'user' | 'guided'): Promise<FinancingComparison>;
  stressTest(productId: string, actor: 'user' | 'guided'): Promise<StressReport>;
  createDraft(productId: string, purpose: string, actor: 'user' | 'guided'): Promise<ApplicationDraft>;
  updateDraftPurpose(applicationId: string, purpose: string): Promise<ApplicationDraft>;
  prepare(applicationId: string, actor: 'user' | 'guided'): Promise<PendingAction>;
  confirm(actionId: string, idempotencyKey: string): Promise<SandboxReceipt>;
  cancel(actionId: string): Promise<void>;
  exportEvidence(redactBusinessName: boolean): Promise<EvidenceBundle>;
  reset(): Promise<void>;
  runAgent?(message: string, history: ChatTurn[]): Promise<AgentTurnResult>;
}

export class ClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 0,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'ClientError';
  }
}
