import { openDB, type IDBPDatabase } from 'idb';
import {
  CashEventSchema,
  DomainError,
  FinancingProductSchema,
  LIMITS,
  WorkspaceSchema,
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
  preparePendingAction,
  projectCashflow,
  randomId,
  sanitizeArgs,
  todayInBusinessZone,
  verifyConfirmation,
  type ApplicationDraft,
  type CashEvent,
  type FinancingProduct,
  type SandboxReceipt,
  type ToolEvent,
  type ToolPolicy,
  type Workspace,
} from '@farmlink/engine';
import { config } from '@/lib/config';
import { ClientError, type SandboxClient, type SandboxSnapshot } from '../types';

const DB_NAME = 'farmlink-sandbox';
const STORE = 'state';
const KEY = 'snapshot-v1';

function emptySnapshot(): SandboxSnapshot {
  return {
    mode: 'guided_local',
    workspace: null,
    events: [],
    catalog: [],
    catalogVersion: 0,
    applications: [],
    actions: [],
    approvals: [],
    runs: [],
    toolEvents: [],
  };
}

interface Persistence {
  read(): Promise<SandboxSnapshot | undefined>;
  write(s: SandboxSnapshot): Promise<void>;
  clear(): Promise<void>;
}

function memoryPersistence(): Persistence {
  let saved: SandboxSnapshot | undefined;
  return {
    read: async () => (saved ? structuredClone(saved) : undefined),
    write: async (s) => {
      saved = structuredClone(s);
    },
    clear: async () => {
      saved = undefined;
    },
  };
}

function idbPersistence(): Persistence {
  let dbp: Promise<IDBPDatabase> | null = null;
  const db = () => (dbp ??= openDB(DB_NAME, 1, { upgrade: (d) => d.createObjectStore(STORE) }));
  return {
    read: async () => (await (await db()).get(STORE, KEY)) as SandboxSnapshot | undefined,
    write: async (s) => {
      await (await db()).put(STORE, s, KEY);
    },
    clear: async () => {
      await (await db()).delete(STORE, KEY);
    },
  };
}

function toClientError(e: unknown): never {
  if (e instanceof DomainError) throw new ClientError(e.code, e.message, e.status);
  if (e instanceof ClientError) throw e;
  throw new ClientError('LOCAL_ERROR', e instanceof Error ? e.message : 'Unexpected local error');
}

/**
 * Guided sandbox: every calculation and workflow transition runs in this browser against
 * local records. Nothing here is a model call, and nothing leaves the device.
 */
export class LocalSandboxClient implements SandboxClient {
  readonly mode = 'guided_local' as const;
  private state: SandboxSnapshot = emptySnapshot();
  private loaded = false;
  private chain: Promise<unknown> = Promise.resolve();
  private readonly store: Persistence;
  private currentRunId = randomId('run');

  constructor(store?: Persistence) {
    this.store = store ?? (typeof indexedDB === 'undefined' ? memoryPersistence() : idbPersistence());
  }

  /** Serialize all mutations so double clicks cannot interleave. */
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    this.chain = next.catch(() => undefined);
    return next;
  }

  private snapshot(): SandboxSnapshot {
    return structuredClone(this.state);
  }

  private async persist() {
    try {
      await this.store.write(this.state);
    } catch {
      // Storage can be unavailable (private mode). The session keeps working in memory.
    }
  }

  private log(actor: ToolEvent['actor'], tool: string, args: unknown, policy: ToolPolicy, outcome: string, versions?: ToolEvent['recordVersions']) {
    const seq = this.state.toolEvents.length + 1;
    this.state.toolEvents.push({
      id: randomId('te'),
      runId: this.currentRunId,
      seq,
      at: new Date().toISOString(),
      mode: 'guided_local',
      actor,
      tool,
      args: sanitizeArgs(args),
      policy,
      outcome,
      recordVersions: versions ?? { workspace: this.state.workspace?.version, catalog: this.state.catalogVersion },
    });
    if (this.state.toolEvents.length > 500) this.state.toolEvents.splice(0, this.state.toolEvents.length - 500);
  }

  private requireWorkspace(): Workspace {
    if (!this.state.workspace) throw new ClientError('NO_WORKSPACE', 'Set up a workspace or load the sandbox demo first.', 400);
    return this.state.workspace;
  }

  private bumpWorkspace() {
    const ws = this.requireWorkspace();
    this.state.workspace = { ...ws, version: ws.version + 1 };
  }

  async load(): Promise<SandboxSnapshot> {
    return this.exclusive(async () => {
      if (!this.loaded) {
        try {
          const saved = await this.store.read();
          if (saved) this.state = { ...emptySnapshot(), ...saved, mode: 'guided_local' };
        } catch {
          this.state = emptySnapshot();
        }
        this.loaded = true;
      }
      this.expireStale();
      return this.snapshot();
    });
  }

  private expireStale() {
    const now = Date.now();
    for (const a of this.state.actions) {
      if (a.status === 'pending' && now > Date.parse(a.expiresAt)) {
        a.status = 'expired';
        const app = this.state.applications.find((x) => x.id === a.applicationId);
        if (app && app.status === 'AWAITING_CONFIRMATION' && app.pendingActionId === a.id) {
          app.status = 'EXPIRED';
          app.pendingActionId = null;
        }
      }
    }
  }

  private mutate<T>(fn: () => T | Promise<T>): Promise<T> {
    return this.exclusive(async () => {
      try {
        const out = await fn();
        await this.persist();
        return out;
      } catch (e) {
        // Keep rejection logs and expiries even when the operation fails.
        await this.persist();
        toClientError(e);
      }
    });
  }

  saveWorkspace(input: Workspace): Promise<SandboxSnapshot> {
    return this.mutate(() => {
      const current = this.state.workspace;
      if (current && input.version !== current.version) {
        throw new ClientError('STALE_VERSION', 'Workspace changed in another tab. Reload and try again.', 409);
      }
      const parsed = WorkspaceSchema.parse({ ...input, version: (current?.version ?? 0) + 1 });
      this.state.workspace = parsed;
      if (!this.state.catalog.length) {
        this.state.catalog = demoCatalog();
        this.state.catalogVersion = DEMO_CATALOG_VERSION;
      }
      this.log('user', 'save_workspace', { asOfDate: parsed.asOfDate, forecastDays: parsed.forecastDays }, 'allowed', `Workspace saved (version ${parsed.version}).`);
      return this.snapshot();
    });
  }

  upsertEvent(event: CashEvent): Promise<SandboxSnapshot> {
    return this.mutate(() => {
      this.requireWorkspace();
      const existing = this.state.events.findIndex((e) => e.id === event.id);
      if (existing < 0 && this.state.events.length >= LIMITS.maxEventsPerWorkspace) {
        throw new ClientError('LIMIT', `Maximum ${LIMITS.maxEventsPerWorkspace} records per workspace.`, 413);
      }
      const prev = existing >= 0 ? this.state.events[existing]! : null;
      const parsed = CashEventSchema.parse({ ...event, version: (prev?.version ?? 0) + 1 });
      if (existing >= 0) this.state.events[existing] = parsed;
      else this.state.events.push(parsed);
      this.bumpWorkspace();
      this.log('user', existing >= 0 ? 'update_record' : 'add_record', { id: parsed.id, direction: parsed.direction, date: parsed.date }, 'allowed', `Record ${parsed.id} saved.`);
      return this.snapshot();
    });
  }

  deleteEvent(id: string): Promise<SandboxSnapshot> {
    return this.mutate(() => {
      this.requireWorkspace();
      const before = this.state.events.length;
      this.state.events = this.state.events.filter((e) => e.id !== id);
      if (before === this.state.events.length) throw new ClientError('NOT_FOUND', 'Record not found.', 404);
      this.bumpWorkspace();
      this.log('user', 'delete_record', { id }, 'allowed', `Record ${id} deleted.`);
      return this.snapshot();
    });
  }

  importEvents(events: CashEvent[]): Promise<SandboxSnapshot> {
    return this.mutate(() => {
      this.requireWorkspace();
      const ids = new Set(this.state.events.map((e) => e.id));
      if (this.state.events.length + events.length > LIMITS.maxEventsPerWorkspace) {
        throw new ClientError('LIMIT', `Import would exceed ${LIMITS.maxEventsPerWorkspace} records.`, 413);
      }
      const parsed = events.map((e) => CashEventSchema.parse(e));
      for (const e of parsed) {
        if (ids.has(e.id)) throw new ClientError('DUPLICATE', `Duplicate id ${e.id}; nothing was imported.`, 409);
        ids.add(e.id);
      }
      this.state.events.push(...parsed);
      this.bumpWorkspace();
      this.log('user', 'import_records', { count: parsed.length }, 'allowed', `Imported ${parsed.length} record(s) atomically.`);
      return this.snapshot();
    });
  }

  saveCatalog(catalog: FinancingProduct[]): Promise<SandboxSnapshot> {
    return this.mutate(() => {
      const parsed = catalog.map((p) => FinancingProductSchema.parse(p));
      this.state.catalog = parsed;
      this.state.catalogVersion += 1;
      this.log('user', 'save_catalog', { products: parsed.length }, 'allowed', `Catalog saved (version ${this.state.catalogVersion}).`);
      return this.snapshot();
    });
  }

  loadDemo(currency: CurrencyCode = 'BDT'): Promise<SandboxSnapshot> {
    return this.mutate(() => {
      const asOf = todayInBusinessZone();
      const prevVersion = this.state.workspace?.version ?? 0;
      this.state = {
        ...emptySnapshot(),
        workspace: { ...demoWorkspace(asOf, 'ws_demo', currency), version: prevVersion + 1 },
        events: demoEvents(asOf, currency),
        catalog: demoCatalog(currency),
        catalogVersion: Math.max(DEMO_CATALOG_VERSION, this.state.catalogVersion + 1),
        toolEvents: this.state.toolEvents,
      };
      this.currentRunId = randomId('run');
      this.log('user', 'load_demo_scenario', { asOfDate: asOf, currency }, 'allowed', `Loaded fictional sandbox demo scenario in ${currency} (sandbox_fixture).`);
      return this.snapshot();
    });
  }

  analyzeCashflow(actor: 'user' | 'guided') {
    return this.mutate(() => {
      const ws = this.requireWorkspace();
      const r = projectCashflow(ws, this.state.events);
      this.log(
        actor,
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

  compareFinancing(actor: 'user' | 'guided') {
    return this.mutate(() => {
      const ws = this.requireWorkspace();
      const c = compareFinancing(ws, this.state.events, this.state.catalog, this.state.catalogVersion);
      const fits = c.evaluations.filter((e) => e.status === 'fits').length;
      this.log(actor, 'match_financing_options', { products: this.state.catalog.length }, 'allowed', `${fits} option(s) fit stated sandbox rules; best: ${c.bestFitProductId ?? 'none'}.`);
      return c;
    });
  }

  stressTest(productId: string, actor: 'user' | 'guided') {
    return this.mutate(() => {
      const ws = this.requireWorkspace();
      const c = compareFinancing(ws, this.state.events, this.state.catalog, this.state.catalogVersion);
      const ev = c.evaluations.find((e) => e.productId === productId);
      if (!ev) throw new ClientError('NOT_FOUND', 'Product not found in the current catalog.', 404);
      const report = stressTestOption(ws, this.state.events, ev);
      if (!report) throw new ClientError('NOT_COSTED', 'This option has no complete quote to stress-test.', 422);
      this.log(actor, 'run_stress_test', { productId }, 'allowed', `${report.passed}/${report.total} stress scenarios keep cash non-negative through maturity (${report.verdict}).`);
      return report;
    });
  }

  createDraft(productId: string, purpose: string, actor: 'user' | 'guided') {
    return this.mutate(() => {
      const ws = this.requireWorkspace();
      const product = this.state.catalog.find((p) => p.id === productId);
      if (!product) throw new ClientError('NOT_FOUND', 'Product not found in the current catalog.', 404);
      const baseline = projectCashflow(ws, this.state.events);
      const cmp = compareFinancing(ws, this.state.events, this.state.catalog, this.state.catalogVersion, baseline);
      const evaluation = cmp.evaluations.find((e) => e.productId === productId)!;
      const draft = buildDraft({ workspace: ws, events: this.state.events, baseline, evaluation, product, catalogVersion: this.state.catalogVersion, purpose, createdBy: 'user', now: new Date() });
      this.state.applications.unshift(draft);
      this.log(actor, 'create_application_draft', { productId, principalMinor: draft.quote.principalMinor }, 'allowed', `Draft ${draft.id} created (no submission).`, { workspace: ws.version, draft: draft.version, catalog: this.state.catalogVersion });
      return structuredClone(draft);
    });
  }

  updateDraftPurpose(applicationId: string, purpose: string) {
    return this.mutate(() => {
      const app = this.findApp(applicationId);
      if (app.status === 'SANDBOX_SUBMITTED' || app.status === 'CANCELLED') throw new ClientError('IMMUTABLE', 'Submitted or cancelled applications cannot be edited.', 409);
      const trimmed = purpose.trim().slice(0, 200);
      app.purpose = trimmed;
      app.sharedFields = app.sharedFields.map((f) => (f.key === 'purpose' ? { ...f, value: trimmed } : f));
      app.version += 1;
      app.updatedAt = new Date().toISOString();
      if (app.pendingActionId) {
        const act = this.state.actions.find((a) => a.id === app.pendingActionId);
        if (act && act.status === 'pending') act.status = 'cancelled';
        app.pendingActionId = null;
      }
      app.status = 'DRAFT';
      this.log('user', 'edit_application_draft', { applicationId, field: 'purpose' }, 'allowed', `Draft edited (version ${app.version}); any pending confirmation was invalidated.`);
      return structuredClone(app);
    });
  }

  private findApp(id: string): ApplicationDraft {
    const app = this.state.applications.find((a) => a.id === id);
    if (!app) throw new ClientError('NOT_FOUND', 'Application not found.', 404);
    return app;
  }

  prepare(applicationId: string, actor: 'user' | 'guided') {
    return this.mutate(async () => {
      const ws = this.requireWorkspace();
      this.expireStale();
      const app = this.findApp(applicationId);
      assertPreparable(app, ws.version, this.state.catalogVersion);
      if (app.pendingActionId) {
        const prev = this.state.actions.find((a) => a.id === app.pendingActionId);
        if (prev && prev.status === 'pending') prev.status = 'cancelled';
      }
      const action = await preparePendingAction(app, 'user', new Date());
      this.state.actions.unshift(action);
      app.status = 'AWAITING_CONFIRMATION';
      app.pendingActionId = action.id;
      app.updatedAt = action.createdAt;
      this.log(actor, 'prepare_sandbox_submission', { applicationId }, 'requires_confirmation', `Pending action ${action.id} frozen (hash ${action.payloadHash.slice(0, 12)}…); waiting for human confirmation.`, { workspace: ws.version, draft: app.version, catalog: this.state.catalogVersion });
      return structuredClone(action);
    });
  }

  confirm(actionId: string, idempotencyKey: string) {
    return this.mutate(async (): Promise<SandboxReceipt> => {
      const ws = this.requireWorkspace();
      const action = this.state.actions.find((a) => a.id === actionId);
      if (!action) throw new ClientError('NOT_FOUND', 'Pending action not found.', 404);
      const app = this.findApp(action.applicationId);
      if (action.status === 'consumed') {
        if (action.idempotencyKey === idempotencyKey && app.receipt) {
          this.log('user', 'confirm_sandbox_submission', { actionId }, 'allowed', 'Duplicate confirmation: returned the original receipt; no new submission.');
          return structuredClone(app.receipt);
        }
        throw new ClientError('IDEMPOTENCY_CONFLICT', 'This action was already confirmed with a different request.', 409);
      }
      const now = new Date();
      try {
        await verifyConfirmation({ action, draft: app, currentWorkspaceVersion: ws.version, currentCatalogVersion: this.state.catalogVersion, now });
      } catch (e) {
        if (e instanceof DomainError && e.code === 'ACTION_EXPIRED') {
          action.status = 'expired';
          app.status = 'EXPIRED';
          app.pendingActionId = null;
        }
        this.log('user', 'confirm_sandbox_submission', { actionId }, 'rejected', e instanceof Error ? e.message : 'Rejected');
        throw e;
      }
      const receipt = buildReceipt({ draft: app, action, mode: 'guided_local', idempotencyKey, now });
      action.status = 'consumed';
      action.idempotencyKey = idempotencyKey;
      app.status = 'SANDBOX_SUBMITTED';
      app.receipt = receipt;
      app.updatedAt = receipt.submittedAt;
      this.state.approvals.unshift({
        id: randomId('apr'),
        pendingActionId: action.id,
        applicationId: app.id,
        payloadHash: action.payloadHash,
        draftVersion: app.version,
        decision: 'confirmed',
        decidedAt: receipt.submittedAt,
        actionExpiresAt: action.expiresAt,
        resultRef: receipt.receiptId,
        mode: 'guided_local',
      });
      this.log('user', 'confirm_sandbox_submission', { actionId }, 'allowed', `Human-confirmed. ${receipt.label}: ${receipt.receiptId}.`);
      return structuredClone(receipt);
    });
  }

  cancel(actionId: string) {
    return this.mutate(() => {
      const action = this.state.actions.find((a) => a.id === actionId);
      if (!action) throw new ClientError('NOT_FOUND', 'Pending action not found.', 404);
      if (action.status !== 'pending') throw new ClientError('ACTION_NOT_PENDING', `Action is ${action.status}; a committed submission cannot be rolled back.`, 409);
      action.status = 'cancelled';
      const app = this.findApp(action.applicationId);
      app.status = 'CANCELLED';
      app.pendingActionId = null;
      this.state.approvals.unshift({
        id: randomId('apr'),
        pendingActionId: action.id,
        applicationId: app.id,
        payloadHash: action.payloadHash,
        draftVersion: app.version,
        decision: 'cancelled',
        decidedAt: new Date().toISOString(),
        actionExpiresAt: action.expiresAt,
        resultRef: null,
        mode: 'guided_local',
      });
      this.log('user', 'cancel_sandbox_submission', { actionId }, 'allowed', 'Pending submission cancelled by the user.');
    });
  }

  exportEvidence(redactBusinessName: boolean) {
    return this.mutate(async () => {
      const ws = this.requireWorkspace();
      this.log('user', 'export_execution_log', { redactBusinessName }, 'allowed', 'Evidence bundle exported.');
      return buildEvidenceBundle({
        generatedAt: new Date().toISOString(),
        mode: 'guided_local',
        build: { frontendSha: config.buildSha, backendSha: null, engineVersion: ENGINE_VERSION },
        provider: null,
        workspace: {
          id: ws.id,
          businessName: ws.businessName,
          businessType: ws.businessType,
          asOfDate: ws.asOfDate,
          forecastDays: ws.forecastDays,
          version: ws.version,
          provenance: ws.provenance,
          eventCount: this.state.events.length,
        },
        applications: this.state.applications,
        pendingActions: this.state.actions,
        approvals: this.state.approvals,
        runs: this.state.runs,
        toolEvents: this.state.toolEvents,
        redactBusinessName,
      });
    });
  }

  reset() {
    return this.exclusive(async () => {
      this.state = emptySnapshot();
      this.currentRunId = randomId('run');
      try {
        await this.store.clear();
      } catch {
        // ignore
      }
    });
  }
}

export { memoryPersistence };
