import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/api/app';
import { loadConfig } from '../src/config';
import { PgStore } from '../src/storage/pg';

/**
 * Opt-in integration tests against a real Postgres (set TEST_DATABASE_URL). They verify
 * atomic confirmation under concurrency, durability across a "restart" (new pool), and
 * atomic quota reservation. Skipped, not passed, when no database is configured.
 */
const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d('PgStore integration', () => {
  const config = loadConfig({ ALLOWED_ORIGINS: 'http://localhost:5173' });

  it('commits one submission under parallel confirmation and survives a restart', async () => {
    const store1 = new PgStore(url!);
    await store1.init();
    const app1 = createApp({ config, store: store1, provider: null });
    const s = await request(app1).post('/v1/sessions').set('Content-Type', 'application/json').send({});
    const auth = { Authorization: `Bearer ${s.body.token}` };
    await request(app1).post('/v1/demo').set(auth).send({});
    const draft = await request(app1).post('/v1/applications/drafts').set(auth).send({ productId: 'sbx-seasonal-a', purpose: 'seed' });
    const action = await request(app1).post(`/v1/applications/${draft.body.id}/prepare`).set(auth).send({});
    const send = () => request(app1).post(`/v1/actions/${action.body.id}/confirm`).set(auth).set('Idempotency-Key', 'pg-key-000001').send({});
    const results = await Promise.all([send(), send(), send()]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(new Set(results.map((r) => r.body.receiptId)).size).toBe(1);
    await store1.close();

    // "Restart": a brand-new pool and app instance reads the committed state.
    const store2 = new PgStore(url!);
    const app2 = createApp({ config, store: store2, provider: null });
    const snap = await request(app2).get('/v1/workspace').set(auth);
    expect(snap.status).toBe(200);
    const submitted = snap.body.applications.filter((a: { status: string }) => a.status === 'SANDBOX_SUBMITTED');
    expect(submitted).toHaveLength(1);
    expect(submitted[0].receipt.receiptId).toBe(results[0]!.body.receiptId);
    await store2.close();
  });

  it('reserves quota atomically under concurrency', async () => {
    const store = new PgStore(url!);
    await store.init();
    const key = `test:${Date.now()}`;
    const w = new Date();
    const r = await Promise.all(Array.from({ length: 20 }, () => store.reserveQuota(key, w, 7)));
    expect(r.filter(Boolean)).toHaveLength(7);
    await store.close();
  });
});
