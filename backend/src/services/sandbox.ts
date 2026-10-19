import {
  CashEventSchema,
  DomainError,
  FinancingProductSchema,
  LIMITS,
  WorkspaceSchema,
  WorkspaceBundleSchema,
  assertPreparable,
  buildDraft,
  buildEvidenceBundle,
  buildReceipt,
  compareFinancing,
  demoCatalog,
  demoEvents,
  demoWorkspace,
  DEMO_CATALOG_VERSION,
  ENGINE_VERSION,
  formatMoney,
  stressTestOption,
  type CurrencyCode,
  type StressReport,
  preparePendingAction,
  projectCashflow,
  randomId,
  sanitizeArgs,
  todayInBusinessZone,
  validateBundle,
  verifyConfirmation,
  type AgentRun,
  type ApplicationDraft,
  type ApprovalDecision,
  type CashEvent,
  type CashflowResult,
  type EvidenceBundle,
  type FinancingComparison,
  type FinancingProduct,
  type PendingAction,
  type SandboxReceipt,
  type ToolEvent,
  type ToolPolicy,
  type Workspace,
  type WorkspaceBundle,
} from '@farmlink/engine';
import { z } from 'zod';
import type { SessionTx, Store } from '../storage/Store';
import { ApiError } from '../security/errors';

export type Actor = 'user' | 'model' | 'system';

export interface BundleDoc {
  workspace: Workspace | null;
  events: CashEvent[];
  catalog: FinancingProduct[];
  catalogVersion: number;
  eventSeq: number;
}

export interface Snapshot {
  mode: 'live_cloud';
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

export interface Ctx {
  sessionId: string;
  actor: Actor;
  runId: string;
}

const emptyBundle = (): BundleDoc => ({ workspace: null, events: [], catalog: [], catalogVersion: 0, eventSeq: 0 });

async function getBundle(tx: SessionTx): Promise<BundleDoc> {
  return (await tx.get<BundleDoc>('bundle', 'main')) ?? emptyBundle();
}

function requireWorkspace(b: BundleDoc): Workspace {
  if (!b.workspace) throw new ApiError(422, 'NO_WORKSPACE', 'Set up a workspace or load the sandbox demo first.');
  return b.workspace;
}

/** Workspace ID is derived from the authenticated session, never from client input. */
function workspaceIdFor(sessionId: string) {
  return `ws_${sessionId.slice(4, 16)}`;
}

export class SandboxService {
  constructor(
    private readonly store: Store,
    private readonly opts: { buildSha: string; providerInfo: () => { name: string; modelId: string } | null; now?: () => Date },
  ) {}

  now() {
    return this.opts.now?.() ?? new Date();
  }

  /** Appends a tool/action event inside the caller's transaction. */
  async log(tx: SessionTx, b: BundleDoc, ctx: Ctx, tool: string, args: unknown, policy: ToolPolicy, outcome: string, versions?: ToolEvent['recordVersions']) {
    b.eventSeq += 1;
    const ev: ToolEvent = {
      id: randomId('te'),
      runId: ctx.runId,
      seq: b.eventSeq,
      at: this.now().toISOString(),
      mode: 'live_cloud',
      actor: ctx.actor === 'system' ? 'system' : ctx.actor,
      tool,
      args: sanitizeArgs(args),
      policy,
      outcome: outcome.slice(0, 400),
      recordVersions: versions ?? { workspace: b.workspace?.version, catalog: b.catalogVersion },
    };
    await tx.put('toolEvent', ev.id, ev);
    await tx.put('bundle', 'main', b);
    return ev;
  }

  /** Logs in its own transaction (used by the agent loop for rejected proposals). */
  async logStandalone(ctx: Ctx, tool: string, args: unknown, policy: ToolPolicy, outcome: string) {
    return this.store.withSession(ctx.sessionId, async (tx) => this.log(tx, await getBundle(tx), ctx, tool, args, policy, outcome));
  }

  async snapshot(sessionId: string): Promise<Snapshot> {
    return this.store.withSession(sessionId, (tx) => this.snapshotTx(tx));
  }

  private async snapshotTx(tx: SessionTx): Promise<Snapshot> {
    const b = await getBundle(tx);
    // Sequential: one Postgres client cannot run concurrent queries inside a transaction.
    const applications = await tx.list<ApplicationDraft>('application', 50);
    const actions = await tx.list<PendingAction>('action', 100);
    const approvals = await tx.list<ApprovalDecision>('approval', 100);
    const runs = await tx.list<AgentRun>('run', 50);
    const toolEvents = await tx.list<ToolEvent>('toolEvent', 300);
    const now = this.now().getTime();
    for (const a of actions) if (a.status === 'pending' && now > Date.parse(a.expiresAt)) a.status = 'expired';
    for (const app of applications) {
      const act = actions.find((x) => x.id === app.pendingActionId);
      if (app.status === 'AWAITING_CONFIRMATION' && act?.status === 'expired') app.status = 'EXPIRED';
    }
    return {
      mode: 'live_cloud',
      workspace: b.workspace,
      events: b.events,
      catalog: b.catalog,
      catalogVersion: b.catalogVersion,
      applications: applications.reverse(),
      actions: actions.reverse(),
      approvals: approvals.reverse(),
      runs,
      toolEvents,
    };
  }

  async saveWorkspace(ctx: Ctx, input: unknown): Promise<Snapshot> {
    return this.store.withSession(ctx.sessionId, async (tx) => {
      const b = await getBundle(tx);
      const candidate = z.object({ version: z.number().int().nonnegative() }).passthrough().parse(input);
      const currentVersion = b.workspace?.version ?? 0;
      if (b.workspace && candidate.version !== currentVersion) throw new ApiError(409, 'STALE_VERSION', 'Workspace changed. Reload and try again.');
      const ws = WorkspaceSchema.parse({ ...candidate, id: workspaceIdFor(ctx.sessionId), version: currentVersion + 1 });
      b.workspace = { ...ws, provenance: ws.provenance === 'sandbox_fixture' ? 'sandbox_fixture' : 'owner_entered' };
      if (!b.catalog.length) {
        b.catalog = demoCatalog();
        b.catalogVersion = DEMO_CATALOG_VERSION;
      }
      await this.log(tx, b, ctx, 'save_workspace', { asOfDate: ws.asOfDate, forecastDays: ws.forecastDays }, 'allowed', `Workspace saved (version ${b.workspace.version}).`);
      return this.snapshotTx(tx);
    });
  }

  private bump(b: BundleDoc) {
    const ws = requireWorkspace(b);
    b.workspace = { ...ws, version: ws.version + 1 };
  }

  async upsertEvent(ctx: Ctx, id: string, input: unknown): Promise<Snapshot> {
    return this.store.withSession(ctx.sessionId, async (tx) => {
      const b = await getBundle(tx);
      requireWorkspace(b);
      const idx = b.events.findIndex((e) => e.id === id);
      if (idx < 0 && b.events.length >= LIMITS.maxEventsPerWorkspace) throw new ApiError(413, 'LIMIT', `Maximum ${LIMITS.maxEventsPerWorkspace} records.`);
      const prev = idx >= 0 ? b.events[idx]! : null;
      const ev = CashEventSchema.parse({ ...(input as object), id, version: (prev?.version ?? 0) + 1 });
      if (idx >= 0) b.events[idx] = ev;
      else b.events.push(ev);
      this.bump(b);
      await this.log(tx, b, ctx, idx >= 0 ? 'update_record' : 'add_record', { id, direction: ev.direction, date: ev.date }, 'allowed', `Record ${id} saved.`);
      return this.snapshotTx(tx);
    });
  }

  async deleteEvent(ctx: Ctx, id: string): Promise<Snapshot> {
    return this.store.withSession(ctx.sessionId, async (tx) => {
      const b = await getBundle(tx);
      requireWorkspace(b);
      const before = b.events.length;
      b.events = b.events.filter((e) => e.id !== id);
      if (before === b.events.length) throw new ApiError(404, 'NOT_FOUND', 'Record not found.');
      this.bump(b);
      await this.log(tx, b, ctx, 'delete_record', { id }, 'allowed', `Record ${id} deleted.`);
      return this.snapshotTx(tx);
    });
  }

  async importEvents(ctx: Ctx, input: unknown): Promise<Snapshot> {
    const events = z.array(CashEventSchema).max(LIMITS.maxEventsPerWorkspace).parse(input);
    return this.store.withSession(ctx.sessionId, async (tx) => {
      const b = await getBundle(tx);
      requireWorkspace(b);
      if (b.events.length + events.length > LIMITS.maxEventsPerWorkspace) throw new ApiError(413, 'LIMIT', 'Import would exceed the record limit.');
      const ids = new Set(b.events.map((e) => e.id));
      for (const e of events) {
        if (ids.has(e.id)) throw new ApiError(409, 'DUPLICATE', `Duplicate id ${e.id}; nothing was imported.`);
        ids.add(e.id);
      }
      b.events.push(...events);
      this.bump(b);
      await this.log(tx, b, ctx, 'import_records', { count: events.length }, 'allowed', `Imported ${events.length} record(s) atomically.`);
      return this.snapshotTx(tx);
    });
  }

  async saveCatalog(ctx: Ctx, input: unknown): Promise<Snapshot> {
    const catalog = z.array(FinancingProductSchema).max(LIMITS.maxProductsInCatalog).parse(input);
    const ids = new Set<string>();
    for (const p of catalog) {
      if (ids.has(p.id)) throw new ApiError(422, 'DUPLICATE', `Duplicate product id ${p.id}.`);
      ids.add(p.id);
      if (BigInt(p.principalMinMinor) > BigInt(p.principalMaxMinor)) throw new ApiError(422, 'VALIDATION_FAILED', `${p.id}: principal minimum exceeds maximum.`);
    }
    return this.store.withSession(ctx.sessionId, async (tx) => {
      const b = await getBundle(tx);
      b.catalog = catalog;
      b.catalogVersion += 1;
      await this.log(tx, b, ctx, 'save_catalog', { products: catalog.length }, 'allowed', `Catalog saved (version ${b.catalogVersion}).`);
      return this.snapshotTx(tx);
    });
  }

  async loadDemo(ctx: Ctx, currency: CurrencyCode = 'BDT'): Promise<Snapshot> {
    return this.store.withSession(ctx.sessionId, async (tx) => {
      const b = await getBundle(tx);
      const asOf = todayInBusinessZone(this.now());
      b.workspace = { ...demoWorkspace(asOf, workspaceIdFor(ctx.sessionId), currency), version: (b.workspace?.version ?? 0) + 1 };
      b.events = demoEvents(asOf, currency);
      b.catalog = demoCatalog(currency);
      b.catalogVersion = Math.max(DEMO_CATALOG_VERSION, b.catalogVersion + 1);
      await this.log(tx, b, ctx, 'load_demo_scenario', { asOfDate: asOf, currency }, 'allowed', `Loaded fictional sandbox demo scenario in ${currency} (sandbox_fixture).`);
      return this.snapshotTx(tx);
    });
  }

  /** Explicit, user-consented copy of local records into this session. */
  async importBundle(ctx: Ctx, input: unknown): Promise<Snapshot> {
    const parsed = WorkspaceBundleSchema.parse(input);
    const v = validateBundle(parsed);
    if (!v.ok) throw new ApiError(422, 'VALIDATION_FAILED', v.issues.slice(0, 5).join('; '));
    return this.store.withSession(ctx.sessionId, async (tx) => {
      const b = await getBundle(tx);
      const incoming: WorkspaceBundle = v.value;
      b.workspace = { ...incoming.workspace, id: workspaceIdFor(ctx.sessionId), version: (b.workspace?.version ?? 0) + 1 };
      b.events = incoming.events;
      b.catalog = incoming.catalog;
      b.catalogVersion = b.catalogVersion + 1;
      await this.log(tx, b, ctx, 'import_local_workspace', { events: incoming.events.length, products: incoming.catalog.length }, 'allowed', 'User-consented copy of local workspace into this cloud session.');
      return this.snapshotTx(tx);
    });
  }

  async analyzeCashflow(ctx: Ctx): Promise<CashflowResult> {
    return this.store.withSession(ctx.sessionId, async (tx) => {
      const b = await getBundle(tx);
      const ws = requireWorkspace(b);
      const r = projectCashflow(ws, b.events);
      await this.log(
        tx,
        b,
        ctx,
        'calculate_cashflow',
        { asOfDate: ws.asOfDate, forecastDays: ws.forecastDays },
        'allowed',
        r.earliestNegativeDate
          ? `Gap ${formatMoney(r.fundingGapMinor, ws.currency)}; first negative ${r.earliestNegativeDate}; ${r.alerts.length} alert day(s).`
          : `No negative cash projected; minimum ${formatMoney(r.minClosingMinor, ws.currency)}.`,
      );
      return r;
    });
  }

  async compareFinancing(ctx: Ctx): Promise<FinancingComparison> {
    return this.store.withSession(ctx.sessionId, async (tx) => {
      const b = await getBundle(tx);
      const ws = requireWorkspace(b);
      const c = compareFinancing(ws, b.events, b.catalog, b.catalogVersion);
      const fits = c.evaluations.filter((e) => e.status === 'fits').length;
      await this.log(tx, b, ctx, 'match_financing_options', { products: b.catalog.length }, 'allowed', `${fits} option(s) fit stated sandbox rules; best: ${c.bestFitProductId ?? 'none'}.`);
      return c;
    });
  }

  async currency(ctx: Ctx): Promise<CurrencyCode> {
    return this.store.withSession(ctx.sessionId, async (tx) => (await getBundle(tx)).workspace?.currency ?? 'BDT');
  }

  async stressTest(ctx: Ctx, productId: string): Promise<StressReport> {
    return this.store.withSession(ctx.sessionId, async (tx) => {
      const b = await getBundle(tx);
      const ws = requireWorkspace(b);
      const c = compareFinancing(ws, b.events, b.catalog, b.catalogVersion);
      const ev = c.evaluations.find((e) => e.productId === productId);
      if (!ev) throw new ApiError(404, 'NOT_FOUND', 'Product not found in the current catalog.');
      const report = stressTestOption(ws, b.events, ev);
      if (!report) throw new ApiError(422, 'NOT_COSTED', 'This option has no complete quote to stress-test.');
      await this.log(tx, b, ctx, 'run_stress_test', { productId }, 'allowed', `${report.passed}/${report.total} stress scenarios keep cash non-negative through maturity (${report.verdict}).`);
      return report;
    });
  }

  /** Stress check of the exact frozen terms of a pending action (read-only, not logged separately). */
  async stressOfAction(ctx: Ctx, action: PendingAction): Promise<StressReport | null> {
    return this.store.withSession(ctx.sessionId, async (tx) => {
      const b = await getBundle(tx);
      return stressTestOption(requireWorkspace(b), b.events, action.payload);
    });
  }

  async getRecords(ctx: Ctx, filter: { status?: CashEvent['status']; limit?: number }) {
    return this.store.withSession(ctx.sessionId, async (tx) => {
      const b = await getBundle(tx);
      const ws = requireWorkspace(b);
      const events = b.events.filter((e) => !filter.status || e.status === filter.status).slice(0, filter.limit ?? 100);
      await this.log(tx, b, ctx, 'get_business_records', filter, 'allowed', `Returned ${events.length} record(s) (workspace v${ws.version}).`);
      return { workspace: ws, events, catalogVersion: b.catalogVersion };
    });
  }

  async createDraft(ctx: Ctx, productId: string, purpose: string): Promise<ApplicationDraft> {
    return this.store.withSession(ctx.sessionId, async (tx) => {
      const b = await getBundle(tx);
      const ws = requireWorkspace(b);
      const product = b.catalog.find((p) => p.id === productId);
      if (!product) throw new ApiError(404, 'NOT_FOUND', 'Product not found in the current catalog.');
      const baseline = projectCashflow(ws, b.events);
      const cmp = compareFinancing(ws, b.events, b.catalog, b.catalogVersion, baseline);
      const evaluation = cmp.evaluations.find((e) => e.productId === productId)!;
      const draft = buildDraft({
        workspace: ws,
        events: b.events,
        baseline,
        evaluation,
        product,
        catalogVersion: b.catalogVersion,
        purpose,
        createdBy: ctx.actor === 'model' ? 'model' : 'user',
        now: this.now(),
      });
      await tx.put('application', draft.id, draft);
      await this.log(tx, b, ctx, 'create_application_draft', { productId, principalMinor: draft.quote.principalMinor }, 'allowed', `Draft ${draft.id} created (no submission).`, {
        workspace: ws.version,
        draft: draft.version,
        catalog: b.catalogVersion,
      });
      return draft;
    });
  }

  async updateDraftPurpose(ctx: Ctx, applicationId: string, purpose: string): Promise<ApplicationDraft> {
    return this.store.withSession(ctx.sessionId, async (tx) => {
      const b = await getBundle(tx);
      const app = await tx.get<ApplicationDraft>('application', applicationId);
      if (!app) throw new ApiError(404, 'NOT_FOUND', 'Application not found.');
      if (app.status === 'SANDBOX_SUBMITTED' || app.status === 'CANCELLED') throw new ApiError(409, 'IMMUTABLE', 'Submitted or cancelled applications cannot be edited.');
      const trimmed = purpose.trim().slice(0, 200);
      app.purpose = trimmed;
      app.sharedFields = app.sharedFields.map((f) => (f.key === 'purpose' ? { ...f, value: trimmed } : f));
      app.version += 1;
      app.updatedAt = this.now().toISOString();
      if (app.pendingActionId) {
        const act = await tx.get<PendingAction>('action', app.pendingActionId);
        if (act && act.status === 'pending') await tx.put('action', act.id, { ...act, status: 'cancelled' });
        app.pendingActionId = null;
      }
      app.status = 'DRAFT';
      await tx.put('application', app.id, app);
      await this.log(tx, b, ctx, 'edit_application_draft', { applicationId, field: 'purpose' }, 'allowed', `Draft edited (version ${app.version}); pending confirmation invalidated.`);
      return app;
    });
  }

  async getApplication(ctx: Ctx, applicationId: string, logIt = false): Promise<ApplicationDraft> {
    return this.store.withSession(ctx.sessionId, async (tx) => {
      const app = await tx.get<ApplicationDraft>('application', applicationId);
      if (!app) throw new ApiError(404, 'NOT_FOUND', 'Application not found.');
      if (logIt) await this.log(tx, await getBundle(tx), ctx, 'get_application_status', { applicationId }, 'allowed', `Status ${app.status}.`);
      return app;
    });
  }

  async listApplications(ctx: Ctx): Promise<ApplicationDraft[]> {
    return this.store.withSession(ctx.sessionId, async (tx) => {
      const apps = (await tx.list<ApplicationDraft>('application', 20)).reverse();
      await this.log(tx, await getBundle(tx), ctx, 'get_application_status', {}, 'allowed', `Returned ${apps.length} application(s).`);
      return apps;
    });
  }

  async prepare(ctx: Ctx, applicationId: string): Promise<PendingAction> {
    return this.store.withSession(ctx.sessionId, async (tx) => {
      const b = await getBundle(tx);
      const ws = requireWorkspace(b);
      const app = await tx.get<ApplicationDraft>('application', applicationId);
      if (!app) throw new ApiError(404, 'NOT_FOUND', 'Application not found.');
      assertPreparable(app, ws.version, b.catalogVersion);
      if (app.pendingActionId) {
        const prev = await tx.get<PendingAction>('action', app.pendingActionId);
        if (prev && prev.status === 'pending') await tx.put('action', prev.id, { ...prev, status: 'cancelled' });
      }
      const action = await preparePendingAction(app, ctx.actor === 'model' ? 'model' : 'user', this.now());
      await tx.put('action', action.id, action);
      app.status = 'AWAITING_CONFIRMATION';
      app.pendingActionId = action.id;
      app.updatedAt = action.createdAt;
      await tx.put('application', app.id, app);
      await this.log(
        tx,
        b,
        ctx,
        'prepare_sandbox_submission',
        { applicationId },
        'requires_confirmation',
        `Pending action ${action.id} frozen (hash ${action.payloadHash.slice(0, 12)}…); waiting for human confirmation.`,
        { workspace: ws.version, draft: app.version, catalog: b.catalogVersion },
      );
      return action;
    });
  }

  /**
   * Human-only confirmation. Reloads the stored action and draft, verifies session ownership
   * (via the session-scoped transaction), expiry, versions, and payload hash, then commits the
   * submission, consumed action, approval, audit event, and receipt atomically.
   */
  async confirm(ctx: Ctx, actionId: string, idempotencyKey: string): Promise<SandboxReceipt> {
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(idempotencyKey)) throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key header is required.');
    const outcome = await this.store.withSession(ctx.sessionId, async (tx): Promise<{ receipt: SandboxReceipt } | { error: ApiError }> => {
      const b = await getBundle(tx);
      const action = await tx.get<PendingAction>('action', actionId);
      if (!action) return { error: new ApiError(404, 'NOT_FOUND', 'Pending action not found.') };
      const app = await tx.get<ApplicationDraft>('application', action.applicationId);
      if (!app) return { error: new ApiError(404, 'NOT_FOUND', 'Application not found.') };
      const ws = requireWorkspace(b);
      if (action.status === 'consumed') {
        if (action.idempotencyKey === idempotencyKey && app.receipt) {
          await this.log(tx, b, ctx, 'confirm_sandbox_submission', { actionId }, 'allowed', 'Duplicate confirmation: returned the original receipt; no new submission.');
          return { receipt: app.receipt };
        }
        await this.log(tx, b, ctx, 'confirm_sandbox_submission', { actionId }, 'rejected', 'Idempotency key reused for a different confirmation.');
        return { error: new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'This action was already confirmed with a different request.') };
      }
      const now = this.now();
      try {
        await verifyConfirmation({ action, draft: app, currentWorkspaceVersion: ws.version, currentCatalogVersion: b.catalogVersion, now });
      } catch (e) {
        if (e instanceof DomainError) {
          if (e.code === 'ACTION_EXPIRED') {
            await tx.put('action', action.id, { ...action, status: 'expired' });
            await tx.put('application', app.id, { ...app, status: 'EXPIRED', pendingActionId: null });
          }
          await this.log(tx, b, ctx, 'confirm_sandbox_submission', { actionId }, 'rejected', e.message);
          return { error: new ApiError(e.status, e.code, e.message) };
        }
        throw e;
      }
      const receipt = buildReceipt({ draft: app, action, mode: 'live_cloud', idempotencyKey, now });
      await tx.put('action', action.id, { ...action, status: 'consumed', idempotencyKey });
      await tx.put('application', app.id, { ...app, status: 'SANDBOX_SUBMITTED', receipt, updatedAt: receipt.submittedAt });
      const approval: ApprovalDecision = {
        id: randomId('apr'),
        pendingActionId: action.id,
        applicationId: app.id,
        payloadHash: action.payloadHash,
        draftVersion: app.version,
        decision: 'confirmed',
        decidedAt: receipt.submittedAt,
        actionExpiresAt: action.expiresAt,
        resultRef: receipt.receiptId,
        mode: 'live_cloud',
      };
      await tx.put('approval', approval.id, approval);
      await this.log(tx, b, ctx, 'confirm_sandbox_submission', { actionId }, 'allowed', `Human-confirmed. Server sandbox receipt ${receipt.receiptId}.`);
      return { receipt };
    });
    if ('error' in outcome) throw outcome.error;
    return outcome.receipt;
  }

  async cancel(ctx: Ctx, actionId: string): Promise<void> {
    const outcome = await this.store.withSession(ctx.sessionId, async (tx) => {
      const b = await getBundle(tx);
      const action = await tx.get<PendingAction>('action', actionId);
      if (!action) return new ApiError(404, 'NOT_FOUND', 'Pending action not found.');
      if (action.status !== 'pending') return new ApiError(409, 'ACTION_NOT_PENDING', `Action is ${action.status}; a committed submission cannot be rolled back.`);
      const app = await tx.get<ApplicationDraft>('application', action.applicationId);
      await tx.put('action', action.id, { ...action, status: 'cancelled' });
      if (app) await tx.put('application', app.id, { ...app, status: 'CANCELLED', pendingActionId: null });
      const approval: ApprovalDecision = {
        id: randomId('apr'),
        pendingActionId: action.id,
        applicationId: action.applicationId,
        payloadHash: action.payloadHash,
        draftVersion: app?.version ?? 0,
        decision: 'cancelled',
        decidedAt: this.now().toISOString(),
        actionExpiresAt: action.expiresAt,
        resultRef: null,
        mode: 'live_cloud',
      };
      await tx.put('approval', approval.id, approval);
      await this.log(tx, b, ctx, 'cancel_sandbox_submission', { actionId }, 'allowed', 'Pending submission cancelled by the user.');
      return null;
    });
    if (outcome) throw outcome;
  }

  async evidence(ctx: Ctx, redact: boolean): Promise<EvidenceBundle> {
    const snap = await this.store.withSession(ctx.sessionId, async (tx) => {
      const b = await getBundle(tx);
      requireWorkspace(b);
      await this.log(tx, b, ctx, 'export_execution_log', { redact }, 'allowed', 'Evidence bundle exported.');
      return this.snapshotTx(tx);
    });
    const ws = snap.workspace!;
    return buildEvidenceBundle({
      generatedAt: this.now().toISOString(),
      mode: 'live_cloud',
      build: { frontendSha: null, backendSha: this.opts.buildSha, engineVersion: ENGINE_VERSION },
      provider: this.opts.providerInfo(),
      workspace: {
        id: ws.id,
        businessName: ws.businessName,
        businessType: ws.businessType,
        asOfDate: ws.asOfDate,
        forecastDays: ws.forecastDays,
        version: ws.version,
        provenance: ws.provenance,
        eventCount: snap.events.length,
      },
      applications: snap.applications,
      pendingActions: snap.actions,
      approvals: snap.approvals,
      runs: snap.runs,
      toolEvents: snap.toolEvents,
      redactBusinessName: redact,
    });
  }

  async saveRun(sessionId: string, run: AgentRun) {
    await this.store.withSession(sessionId, (tx) => tx.put('run', run.id, run));
  }

  async getRun(sessionId: string, runId: string) {
    return this.store.withSession(sessionId, async (tx) => {
      const run = await tx.get<AgentRun>('run', runId);
      if (!run) throw new ApiError(404, 'NOT_FOUND', 'Run not found.');
      const events = (await tx.list<ToolEvent>('toolEvent', 300)).filter((e) => e.runId === runId);
      return { run, toolEvents: events };
    });
  }
}
