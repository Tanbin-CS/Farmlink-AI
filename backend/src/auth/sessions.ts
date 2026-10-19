import { createHash, randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Store, SessionRow } from '../storage/Store';
import { ApiError } from '../security/errors';

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Anonymous sandbox sessions: a 32-byte random bearer capability is returned once; only its
 * SHA-256 hash is stored. This isolates demo data; it is not identity verification.
 */
export async function issueSession(store: Store, ttlMs: number, now: Date): Promise<{ token: string; session: SessionRow }> {
  const token = randomBytes(32).toString('base64url');
  const session: SessionRow = {
    id: `ses_${randomBytes(12).toString('base64url')}`,
    tokenHash: hashToken(token),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
  };
  await store.createSession(session);
  return { token, session };
}

declare module 'express-serve-static-core' {
  interface Request {
    session?: SessionRow;
    requestId: string;
  }
}

export function requireSession(store: Store, now: () => Date) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.get('authorization') ?? '';
      const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(header);
      if (!m) throw new ApiError(401, 'SESSION_REQUIRED', 'A valid sandbox session is required.');
      const session = await store.findSessionByTokenHash(hashToken(m[1]!));
      if (!session || Date.parse(session.expiresAt) <= now().getTime()) {
        throw new ApiError(401, 'SESSION_EXPIRED', 'The sandbox session is missing or expired. Start a new live session.');
      }
      req.session = session;
      next();
    } catch (e) {
      next(e);
    }
  };
}
