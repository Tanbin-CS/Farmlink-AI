import type { DocKind, SessionRow, SessionTx, Store } from './Store';

interface Doc {
  seq: number;
  data: unknown;
}

/**
 * In-memory store for tests and local development only. Not durable: a restart loses
 * everything, so health reports durable=false and production should use Postgres.
 */
export class MemoryStore implements Store {
  readonly kind = 'memory' as const;
  readonly durable = false;
  private sessions = new Map<string, SessionRow>();
  private docs = new Map<string, Map<string, Doc>>(); // `${session}|${kind}` -> id -> doc
  private quotas = new Map<string, { count: number; windowStart: number }>();
  private locks = new Map<string, Promise<unknown>>();
  private seq = 0;

  async init() {}

  async createSession(row: SessionRow) {
    this.sessions.set(row.id, { ...row });
  }

  async findSessionByTokenHash(hash: string) {
    for (const s of this.sessions.values()) if (s.tokenHash === hash) return { ...s };
    return null;
  }

  async deleteSession(id: string) {
    this.sessions.delete(id);
    for (const k of [...this.docs.keys()]) if (k.startsWith(`${id}|`)) this.docs.delete(k);
  }

  async purgeExpiredSessions(now: Date, limit: number) {
    let n = 0;
    for (const s of [...this.sessions.values()]) {
      if (n >= limit) break;
      if (Date.parse(s.expiresAt) <= now.getTime()) {
        await this.deleteSession(s.id);
        n++;
      }
    }
    return n;
  }

  async withSession<T>(sessionId: string, fn: (tx: SessionTx) => Promise<T>): Promise<T> {
    const prev = this.locks.get(sessionId) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((r) => (release = r));
    this.locks.set(sessionId, prev.then(() => mine));
    await prev;
    try {
      // Buffer writes and apply them only if fn succeeds (atomic commit).
      const writes = new Map<string, { kind: DocKind; id: string; data: unknown | undefined }>();
      const key = (k: DocKind) => `${sessionId}|${k}`;
      const tx: SessionTx = {
        sessionId,
        get: async <D>(kind: DocKind, id: string) => {
          const w = writes.get(`${kind}|${id}`);
          if (w) return (w.data === undefined ? null : structuredClone(w.data)) as D | null;
          const d = this.docs.get(key(kind))?.get(id);
          return d ? (structuredClone(d.data) as D) : null;
        },
        list: async <D>(kind: DocKind, limit = 1000) => {
          const base = new Map([...(this.docs.get(key(kind))?.entries() ?? [])].map(([id, d]) => [id, d] as const));
          const out: Array<{ seq: number; data: unknown }> = [];
          let pendingSeq = this.seq;
          for (const [id, d] of base) {
            const w = writes.get(`${kind}|${id}`);
            if (w?.data === undefined && w) continue;
            out.push({ seq: d.seq, data: w ? w.data : d.data });
          }
          for (const [k, w] of writes) {
            const [wk, id] = k.split('|') as [DocKind, string];
            if (wk === kind && !base.has(id) && w.data !== undefined) out.push({ seq: ++pendingSeq, data: w.data });
          }
          return out
            .sort((a, b) => a.seq - b.seq)
            .slice(-limit)
            .map((x) => structuredClone(x.data) as D);
        },
        put: async (kind, id, data) => {
          writes.set(`${kind}|${id}`, { kind, id, data: structuredClone(data) });
        },
        remove: async (kind, id) => {
          writes.set(`${kind}|${id}`, { kind, id, data: undefined });
        },
      };
      if (!this.sessions.has(sessionId)) throw new Error('Session not found');
      const result = await fn(tx);
      for (const w of writes.values()) {
        let m = this.docs.get(key(w.kind));
        if (!m) {
          m = new Map();
          this.docs.set(key(w.kind), m);
        }
        if (w.data === undefined) m.delete(w.id);
        else {
          const existing = m.get(w.id);
          m.set(w.id, { seq: existing?.seq ?? ++this.seq, data: w.data });
        }
      }
      return result;
    } finally {
      release();
    }
  }

  async reserveQuota(key: string, windowStart: Date, limit: number) {
    const ws = windowStart.getTime();
    const q = this.quotas.get(key);
    if (!q || q.windowStart < ws) {
      if (limit < 1) return false;
      this.quotas.set(key, { count: 1, windowStart: ws });
      return true;
    }
    if (q.count >= limit) return false;
    q.count++;
    return true;
  }

  async ping() {
    return true;
  }

  async close() {}
}
