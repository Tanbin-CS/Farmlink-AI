import pg from 'pg';
import type { DocKind, SessionRow, SessionTx, Store } from './Store';

const SCHEMA = `
create table if not exists sessions (
  id text primary key,
  token_hash text not null unique,
  created_at timestamptz not null,
  expires_at timestamptz not null
);
create index if not exists sessions_expires_idx on sessions (expires_at);
create table if not exists docs (
  session_id text not null references sessions(id) on delete cascade,
  kind text not null,
  id text not null,
  seq bigserial,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (session_id, kind, id)
);
create index if not exists docs_order_idx on docs (session_id, kind, seq);
create table if not exists quotas (
  key text primary key,
  count integer not null,
  window_start timestamptz not null
);
`;

/**
 * Neon's copy-paste strings include libpq-only options (channel_binding) that node-postgres
 * does not use. Strip them, and make TLS certificate verification explicit (verify-full).
 */
export function normalizeConnectionString(raw: string): string {
  const u = new URL(raw.trim());
  u.searchParams.delete('channel_binding');
  if (u.searchParams.get('sslmode') === 'require') u.searchParams.set('sslmode', 'verify-full');
  return u.toString();
}

/** Postgres store (Neon or Render Postgres). Session-scoped work runs in one transaction holding a row lock. */
export class PgStore implements Store {
  readonly kind = 'postgres' as const;
  readonly durable = true;
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString: normalizeConnectionString(connectionString), max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
  }

  async init() {
    await this.pool.query(SCHEMA);
  }

  async createSession(row: SessionRow) {
    await this.pool.query('insert into sessions (id, token_hash, created_at, expires_at) values ($1, $2, $3, $4)', [row.id, row.tokenHash, row.createdAt, row.expiresAt]);
  }

  async findSessionByTokenHash(hash: string) {
    const r = await this.pool.query('select id, token_hash, created_at, expires_at from sessions where token_hash = $1', [hash]);
    const x = r.rows[0];
    return x ? { id: x.id, tokenHash: x.token_hash, createdAt: new Date(x.created_at).toISOString(), expiresAt: new Date(x.expires_at).toISOString() } : null;
  }

  async deleteSession(id: string) {
    await this.pool.query('delete from sessions where id = $1', [id]);
  }

  async purgeExpiredSessions(now: Date, limit: number) {
    const r = await this.pool.query('delete from sessions where id in (select id from sessions where expires_at <= $1 limit $2)', [now.toISOString(), limit]);
    return r.rowCount ?? 0;
  }

  async withSession<T>(sessionId: string, fn: (tx: SessionTx) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const lock = await client.query('select id from sessions where id = $1 for update', [sessionId]);
      if (!lock.rowCount) throw new Error('Session not found');
      const tx: SessionTx = {
        sessionId,
        get: async <D>(kind: DocKind, id: string) => {
          const r = await client.query('select data from docs where session_id = $1 and kind = $2 and id = $3', [sessionId, kind, id]);
          return (r.rows[0]?.data ?? null) as D | null;
        },
        list: async <D>(kind: DocKind, limit = 1000) => {
          const r = await client.query('select data from (select data, seq from docs where session_id = $1 and kind = $2 order by seq desc limit $3) t order by seq asc', [
            sessionId,
            kind,
            limit,
          ]);
          return r.rows.map((x) => x.data as D);
        },
        put: async (kind, id, data) => {
          await client.query(
            `insert into docs (session_id, kind, id, data) values ($1, $2, $3, $4)
             on conflict (session_id, kind, id) do update set data = excluded.data, updated_at = now()`,
            [sessionId, kind, id, JSON.stringify(data)],
          );
        },
        remove: async (kind, id) => {
          await client.query('delete from docs where session_id = $1 and kind = $2 and id = $3', [sessionId, kind, id]);
        },
      };
      const result = await fn(tx);
      await client.query('commit');
      return result;
    } catch (e) {
      await client.query('rollback').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }

  async reserveQuota(key: string, windowStart: Date, limit: number) {
    if (limit < 1) return false;
    const r = await this.pool.query(
      `insert into quotas (key, count, window_start) values ($1, 1, $2)
       on conflict (key) do update set
         count = case when quotas.window_start < $2 then 1 else quotas.count + 1 end,
         window_start = case when quotas.window_start < $2 then $2 else quotas.window_start end
       where quotas.window_start < $2 or quotas.count < $3
       returning count`,
      [key, windowStart.toISOString(), limit],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async ping() {
    try {
      await this.pool.query('select 1');
      return true;
    } catch {
      return false;
    }
  }

  async close() {
    await this.pool.end();
  }
}
