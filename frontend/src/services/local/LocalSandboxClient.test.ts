import { describe, expect, it } from 'vitest';
import { LocalSandboxClient, memoryPersistence } from './LocalSandboxClient';

async function ready() {
  const c = new LocalSandboxClient(memoryPersistence());
  await c.load();
  await c.loadDemo();
  return c;
}

describe('LocalSandboxClient (guided mode)', () => {
  it('runs the full draft → prepare → confirm flow and is idempotent on retry', async () => {
    const c = await ready();
    const cmp = await c.compareFinancing('guided');
    const draft = await c.createDraft(cmp.bestFitProductId!, 'Seed purchase', 'guided');
    const action = await c.prepare(draft.id, 'guided');
    const [a, b] = await Promise.all([c.confirm(action.id, 'key-1'), c.confirm(action.id, 'key-1')]);
    expect(a.receiptId).toBe(b.receiptId);
    expect(a.label).toBe('Local sandbox receipt — browser only');
    const snap = await c.load();
    expect(snap.applications.filter((x) => x.status === 'SANDBOX_SUBMITTED')).toHaveLength(1);
    await expect(c.confirm(action.id, 'key-2')).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('rejects confirmation after records change (stale review)', async () => {
    const c = await ready();
    const cmp = await c.compareFinancing('user');
    const draft = await c.createDraft(cmp.bestFitProductId!, 'x', 'user');
    const action = await c.prepare(draft.id, 'user');
    const snap = await c.load();
    await c.upsertEvent({ ...snap.events[3]!, description: 'edited after review' });
    await expect(c.confirm(action.id, 'k')).rejects.toMatchObject({ code: 'STALE_DRAFT' });
    const after = await c.load();
    expect(after.applications[0]!.status).toBe('AWAITING_CONFIRMATION');
    expect(after.toolEvents.some((e) => e.tool === 'confirm_sandbox_submission' && e.policy === 'rejected')).toBe(true);
  });

  it('editing the draft invalidates the pending action', async () => {
    const c = await ready();
    const cmp = await c.compareFinancing('user');
    const draft = await c.createDraft(cmp.bestFitProductId!, 'x', 'user');
    const action = await c.prepare(draft.id, 'user');
    await c.updateDraftPurpose(draft.id, 'changed');
    await expect(c.confirm(action.id, 'k')).rejects.toMatchObject({ code: 'ACTION_NOT_PENDING' });
  });

  it('refuses drafts for options that do not fit', async () => {
    const c = await ready();
    await expect(c.createDraft('sbx-supplier-c', 'x', 'user')).rejects.toMatchObject({ code: 'PRODUCT_NOT_FIT' });
  });

  it('exports evidence with mode and content hash', async () => {
    const c = await ready();
    const b = await c.exportEvidence(true);
    expect(b.mode).toBe('guided_local');
    expect(b.workspace.businessName).toBe('[redacted]');
    expect(b.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
