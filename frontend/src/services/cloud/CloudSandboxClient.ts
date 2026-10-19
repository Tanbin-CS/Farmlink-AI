import type {
  ApplicationDraft,
  CashEvent,
  CashflowResult,
  EvidenceBundle,
  FinancingComparison,
  FinancingProduct,
  PendingAction,
  SandboxReceipt,
  Workspace,
  WorkspaceBundle,
} from '@farmlink/engine';
import { ClientError, type AgentTurnResult, type ChatTurn, type SandboxClient, type SandboxSnapshot } from '../types';

const TOKEN_KEY = 'farmlink.session';

export interface HealthInfo {
  status: string;
  version: string;
  buildSha: string;
  liveAiEnabled: boolean;
  aiAvailable: boolean;
  provider: { name: string; modelId: string } | null;
}

interface StoredSession {
  token: string;
  expiresAt: string;
  apiBaseUrl: string;
}

function readSession(apiBaseUrl: string): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    if (s.apiBaseUrl !== apiBaseUrl || Date.parse(s.expiresAt) <= Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

async function request<T>(base: string, path: string, init: RequestInit & { token?: string; timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 30_000);
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, headers, signal: controller.signal, credentials: 'omit', mode: 'cors' });
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError';
    throw new ClientError(aborted ? 'TIMEOUT' : 'NETWORK', aborted ? 'The live API did not respond in time.' : 'The live API is unreachable.', 0, true);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string; retryable?: boolean } } | null;
  if (!res.ok) {
    const err = body?.error;
    throw new ClientError(err?.code ?? `HTTP_${res.status}`, err?.message ?? `Request failed (${res.status}).`, res.status, !!err?.retryable);
  }
  return body as T;
}

export async function fetchHealth(base: string): Promise<HealthInfo> {
  return request<HealthInfo>(base, '/v1/health', { timeoutMs: 60_000 });
}

/**
 * Live mode client. The bearer capability lives in sessionStorage only (never in a URL,
 * analytics event, or build variable). The server derives the workspace from the session.
 */
export class CloudSandboxClient implements SandboxClient {
  readonly mode = 'live_cloud' as const;

  private constructor(
    private readonly base: string,
    private session: StoredSession,
  ) {}

  static async connect(base: string, opts: { fresh?: boolean } = {}): Promise<CloudSandboxClient> {
    const existing = opts.fresh ? null : readSession(base);
    if (existing) return new CloudSandboxClient(base, existing);
    const created = await request<{ token: string; expiresAt: string }>(base, '/v1/sessions', { method: 'POST', body: '{}', timeoutMs: 60_000 });
    const session: StoredSession = { token: created.token, expiresAt: created.expiresAt, apiBaseUrl: base };
    try {
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify(session));
    } catch {
      // Session survives only in memory if storage is unavailable.
    }
    return new CloudSandboxClient(base, session);
  }

  private call<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
    return request<T>(this.base, path, { ...init, token: this.session.token });
  }

  load() {
    return this.call<SandboxSnapshot>('/v1/workspace');
  }
  saveWorkspace(workspace: Workspace) {
    return this.call<SandboxSnapshot>('/v1/workspace', { method: 'PUT', body: JSON.stringify({ workspace }) });
  }
  upsertEvent(event: CashEvent) {
    return this.call<SandboxSnapshot>(`/v1/records/${encodeURIComponent(event.id)}`, { method: 'PUT', body: JSON.stringify({ event }) });
  }
  deleteEvent(id: string) {
    return this.call<SandboxSnapshot>(`/v1/records/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
  importEvents(events: CashEvent[]) {
    return this.call<SandboxSnapshot>('/v1/records/import', { method: 'POST', body: JSON.stringify({ events }) });
  }
  saveCatalog(catalog: FinancingProduct[]) {
    return this.call<SandboxSnapshot>('/v1/catalog', { method: 'PUT', body: JSON.stringify({ catalog }) });
  }
  loadDemo() {
    return this.call<SandboxSnapshot>('/v1/demo', { method: 'POST', body: '{}' });
  }
  importBundle(bundle: WorkspaceBundle) {
    return this.call<SandboxSnapshot>('/v1/workspace/import', { method: 'POST', body: JSON.stringify({ bundle }) });
  }
  analyzeCashflow() {
    return this.call<CashflowResult>('/v1/analysis/cashflow', { method: 'POST', body: '{}' });
  }
  compareFinancing() {
    return this.call<FinancingComparison>('/v1/analysis/financing', { method: 'POST', body: '{}' });
  }
  createDraft(productId: string, purpose: string) {
    return this.call<ApplicationDraft>('/v1/applications/drafts', { method: 'POST', body: JSON.stringify({ productId, purpose }) });
  }
  updateDraftPurpose(applicationId: string, purpose: string) {
    return this.call<ApplicationDraft>(`/v1/applications/${encodeURIComponent(applicationId)}`, { method: 'PATCH', body: JSON.stringify({ purpose }) });
  }
  prepare(applicationId: string) {
    return this.call<PendingAction>(`/v1/applications/${encodeURIComponent(applicationId)}/prepare`, { method: 'POST', body: '{}' });
  }
  async confirm(actionId: string, idempotencyKey: string): Promise<SandboxReceipt> {
    const path = `/v1/actions/${encodeURIComponent(actionId)}/confirm`;
    try {
      return await this.call<SandboxReceipt>(path, { method: 'POST', body: '{}', headers: { 'Idempotency-Key': idempotencyKey } });
    } catch (e) {
      // A lost response is retried once with the SAME key; the server returns the original receipt.
      if (e instanceof ClientError && (e.code === 'NETWORK' || e.code === 'TIMEOUT')) {
        return this.call<SandboxReceipt>(path, { method: 'POST', body: '{}', headers: { 'Idempotency-Key': idempotencyKey } });
      }
      throw e;
    }
  }
  async cancel(actionId: string) {
    await this.call(`/v1/actions/${encodeURIComponent(actionId)}/cancel`, { method: 'POST', body: '{}' });
  }
  exportEvidence(redactBusinessName: boolean) {
    return this.call<EvidenceBundle>(`/v1/evidence${redactBusinessName ? '?redact=1' : ''}`);
  }
  async reset() {
    await this.call('/v1/session', { method: 'DELETE' });
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  }
  runAgent(message: string, history: ChatTurn[]) {
    return this.call<AgentTurnResult>('/v1/agent/runs', { method: 'POST', body: JSON.stringify({ message, history }), timeoutMs: 90_000 });
  }
}
