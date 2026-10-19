import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ENGINE_VERSION, SCHEMA_VERSION } from '@farmlink/engine';
import type { AppConfig } from '../config';
import type { Store } from '../storage/Store';
import { issueSession, requireSession } from '../auth/sessions';
import { ApiError, toApiError } from '../security/errors';
import { Quotas } from '../security/quota';
import { SandboxService, type Ctx } from '../services/sandbox';
import { runAgentTurn } from '../agent/loop';
import type { ModelProvider } from '../agent/provider';

export interface AppDeps {
  config: AppConfig;
  store: Store;
  provider: ModelProvider | null;
  now?: () => Date;
}

const ChatSchema = z
  .object({
    message: z.string().trim().min(1).max(1000),
    history: z
      .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(2000) }).strict())
      .max(6)
      .default([]),
  })
  .strict();

export function createApp({ config, store, provider, now = () => new Date() }: AppDeps) {
  const app = express();
  const quotas = new Quotas(store, config);
  const svc = new SandboxService(store, {
    buildSha: config.buildSha,
    providerInfo: () => (provider ? { name: provider.name, modelId: provider.modelId } : null),
    now,
  });
  const aiAvailable = () => config.liveAiEnabled && !!provider;

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });
  app.use(
    cors({
      // Exact origins only (scheme + host + port). CORS is not authentication.
      origin: (origin, cb) => cb(null, !origin || config.allowedOrigins.includes(origin)),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
      exposedHeaders: ['X-Request-Id'],
      credentials: false,
      maxAge: 600,
    }),
  );
  app.use((req, _res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.headers['content-length'] !== '0' && !req.is('application/json')) {
      return next(new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.'));
    }
    next();
  });
  app.use(express.json({ limit: '1mb', strict: true }));

  const sessionLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
  const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false });
  const auth = requireSession(store, now);
  const ctx = (req: Request): Ctx => ({ sessionId: req.session!.id, actor: 'user', runId: `ui_${req.requestId.slice(0, 8)}` });
  const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => {
    fn(req, res)
      .then((body) => {
        if (body === undefined) res.status(204).end();
        else res.json(body);
      })
      .catch(next);
  };
  const v1 = express.Router();

  v1.get(
    '/health',
    h(async () => ({
      status: (await store.ping()) ? 'ok' : 'degraded',
      version: '0.2.0',
      buildSha: config.buildSha,
      engineVersion: ENGINE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      mode: 'live_cloud',
      storage: store.kind,
      durableStorage: store.durable,
      liveAiEnabled: config.liveAiEnabled,
      aiAvailable: aiAvailable(),
      provider: aiAvailable() && provider ? { name: provider.name, modelId: provider.modelId } : null,
    })),
  );

  v1.post(
    '/sessions',
    sessionLimiter,
    h(async () => {
      const t = now();
      if (!(await quotas.reserveSessionIssue(t))) throw new ApiError(429, 'QUOTA_EXHAUSTED', 'Too many demo sessions this hour. Try again later or use guided mode.');
      await store.purgeExpiredSessions(t, 50).catch(() => 0);
      const { token, session } = await issueSession(store, config.sessionTtlMs, t);
      return { token, expiresAt: session.expiresAt, mode: 'live_cloud' };
    }),
  );

  v1.use(apiLimiter, auth);

  v1.get('/workspace', h(async (req) => svc.snapshot(req.session!.id)));
  v1.put('/workspace', h(async (req) => svc.saveWorkspace(ctx(req), z.object({ workspace: z.unknown() }).parse(req.body).workspace)));
  v1.post('/workspace/import', h(async (req) => svc.importBundle(ctx(req), z.object({ bundle: z.unknown() }).parse(req.body).bundle)));
  v1.post('/demo', h(async (req) => svc.loadDemo(ctx(req))));
  v1.put('/records/:id', h(async (req) => svc.upsertEvent(ctx(req), String(req.params.id), z.object({ event: z.object({}).passthrough() }).parse(req.body).event)));
  v1.delete('/records/:id', h(async (req) => svc.deleteEvent(ctx(req), String(req.params.id))));
  v1.post('/records/import', h(async (req) => svc.importEvents(ctx(req), z.object({ events: z.unknown() }).parse(req.body).events)));
  v1.put('/catalog', h(async (req) => svc.saveCatalog(ctx(req), z.object({ catalog: z.unknown() }).parse(req.body).catalog)));
  v1.post('/analysis/cashflow', h(async (req) => svc.analyzeCashflow(ctx(req))));
  v1.post('/analysis/financing', h(async (req) => svc.compareFinancing(ctx(req))));
  v1.post(
    '/applications/drafts',
    h(async (req) => {
      const b = z.object({ productId: z.string().max(64), purpose: z.string().max(200).default('') }).strict().parse(req.body);
      return svc.createDraft(ctx(req), b.productId, b.purpose);
    }),
  );
  v1.get('/applications/:id', h(async (req) => svc.getApplication(ctx(req), String(req.params.id))));
  v1.patch('/applications/:id', h(async (req) => svc.updateDraftPurpose(ctx(req), String(req.params.id), z.object({ purpose: z.string().max(200) }).strict().parse(req.body).purpose)));
  v1.post('/applications/:id/prepare', h(async (req) => svc.prepare(ctx(req), String(req.params.id))));
  // Human confirmation endpoint. It is not in the model's tool registry.
  v1.post('/actions/:id/confirm', h(async (req) => svc.confirm(ctx(req), String(req.params.id), req.get('idempotency-key') ?? '')));
  v1.post('/actions/:id/cancel', h(async (req) => svc.cancel(ctx(req), String(req.params.id))));
  v1.post(
    '/agent/runs',
    h(async (req) => {
      const body = ChatSchema.parse(req.body);
      return runAgentTurn({ sessionId: req.session!.id, message: body.message, history: body.history, provider, svc, quotas, config, now });
    }),
  );
  v1.get('/agent/runs/:id', h(async (req) => svc.getRun(req.session!.id, String(req.params.id))));
  v1.get('/evidence', h(async (req) => svc.evidence(ctx(req), req.query.redact === '1')));
  v1.delete(
    '/session',
    h(async (req) => {
      await store.deleteSession(req.session!.id);
      return undefined;
    }),
  );

  app.use('/v1', v1);
  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Not found.')));
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    let e = toApiError(err);
    if (err && typeof err === 'object' && 'type' in err && (err as { type: string }).type === 'entity.too.large') e = new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large.');
    else if (err instanceof SyntaxError) e = new ApiError(400, 'MALFORMED_JSON', 'Malformed JSON body.');
    else if (err instanceof Error && err.message === 'Session not found') e = new ApiError(401, 'SESSION_EXPIRED', 'The sandbox session no longer exists.');
    if (e.status >= 500 && e.code === 'INTERNAL') console.error(`[${req.requestId}]`, err instanceof Error ? err.message : err);
    res.status(e.status).json({ error: { code: e.code, message: e.message, requestId: req.requestId, retryable: e.retryable } });
  });
  return app;
}
