export type DocKind = 'bundle' | 'application' | 'action' | 'approval' | 'run' | 'toolEvent';

export interface SessionRow {
  id: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
}

/** Operations inside one session-scoped transaction. All reads and writes are bound to that session. */
export interface SessionTx {
  readonly sessionId: string;
  get<T>(kind: DocKind, id: string): Promise<T | null>;
  /** Documents of a kind, in insertion order. */
  list<T>(kind: DocKind, limit?: number): Promise<T[]>;
  put<T>(kind: DocKind, id: string, data: T): Promise<void>;
  remove(kind: DocKind, id: string): Promise<void>;
}

/**
 * Durable storage boundary. `withSession` serializes all work for one session (row lock in
 * Postgres, mutex in memory) and commits atomically, so a double-clicked confirmation cannot
 * create two submissions.
 */
export interface Store {
  readonly kind: 'postgres' | 'memory';
  readonly durable: boolean;
  init(): Promise<void>;
  createSession(row: SessionRow): Promise<void>;
  findSessionByTokenHash(hash: string): Promise<SessionRow | null>;
  deleteSession(id: string): Promise<void>;
  purgeExpiredSessions(now: Date, limit: number): Promise<number>;
  withSession<T>(sessionId: string, fn: (tx: SessionTx) => Promise<T>): Promise<T>;
  /** Atomically increments a fixed-window counter if below limit. Returns false when exhausted. */
  reserveQuota(key: string, windowStart: Date, limit: number): Promise<boolean>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}
