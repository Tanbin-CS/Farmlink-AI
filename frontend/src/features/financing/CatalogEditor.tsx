import { useState } from 'react';
import { z } from 'zod';
import { FinancingProductSchema, LIMITS, demoCatalog } from '@farmlink/engine';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { useSandbox } from '@/state/SandboxProvider';

const CatalogSchema = z.array(FinancingProductSchema).max(LIMITS.maxProductsInCatalog);

/**
 * Structured JSON editor for the sandbox catalog. Unknown terms must be null (never 0), and a
 * public_reference product must carry its official sourceUrl and retrievedAt date.
 */
export function CatalogEditor({ onClose }: { onClose: () => void }) {
  const { snapshot, run, busy } = useSandbox();
  const [text, setText] = useState(() => JSON.stringify(snapshot?.catalog ?? [], null, 2));
  const [issues, setIssues] = useState<string[]>([]);

  const save = async () => {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      setIssues(['Not valid JSON.']);
      return;
    }
    const parsed = CatalogSchema.safeParse(raw);
    if (!parsed.success) {
      setIssues(parsed.error.issues.slice(0, 20).map((i) => `${i.path.join('.')}: ${i.message}`));
      return;
    }
    const extra: string[] = [];
    const ids = new Set<string>();
    for (const p of parsed.data) {
      if (ids.has(p.id)) extra.push(`Duplicate id ${p.id}`);
      ids.add(p.id);
      if (BigInt(p.principalMinMinor) > BigInt(p.principalMaxMinor)) extra.push(`${p.id}: principal minimum exceeds maximum`);
      if (p.classification === 'public_reference' && (!p.sourceUrl || !p.retrievedAt)) extra.push(`${p.id}: public_reference products need sourceUrl and retrievedAt`);
    }
    if (extra.length) {
      setIssues(extra);
      return;
    }
    const r = await run('Save catalog', (c) => c.saveCatalog(parsed.data), { success: 'Catalog saved. Existing drafts now require a new review.' });
    if (r) onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit financing catalog</DialogTitle>
          <DialogDescription>
            Amounts are integer minor units (paisa) as strings; rates and fees in basis points. Use <code>null</code> for unknown terms. Do not label invented terms as a real
            lender&apos;s product.
          </DialogDescription>
        </DialogHeader>
        <Textarea aria-label="Catalog JSON" className="h-96 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        {issues.length ? (
          <Alert variant="danger">
            <ul className="list-disc pl-4">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setText(JSON.stringify(demoCatalog(), null, 2))}>
            Restore demo catalog
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            Validate and save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
