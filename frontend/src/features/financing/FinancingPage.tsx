import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { REASON_TEXT, TRUTH_LABELS, formatBDT, type FinancingProduct, type ProductEvaluation } from '@farmlink/engine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Label } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Alert } from '@/components/ui/alert';
import { Money, PageHeader, StatusBadge, TruthNote } from '@/components/common';
import { useSandbox } from '@/state/SandboxProvider';
import { RequireWorkspace } from '@/app/RequireWorkspace';
import { CatalogEditor } from './CatalogEditor';

export function FinancingPage() {
  return (
    <RequireWorkspace>
      <FinancingInner />
    </RequireWorkspace>
  );
}

function FinancingInner() {
  const { comparison, snapshot, derivedError, run, busy } = useSandbox();
  const navigate = useNavigate();
  const [purpose, setPurpose] = useState('Seasonal working capital for seed and fertilizer before harvest');
  const [editing, setEditing] = useState(false);
  if (derivedError) return <Alert variant="danger">{derivedError}</Alert>;
  if (!comparison) return null;
  const catalogById = new Map(snapshot!.catalog.map((p) => [p.id, p]));

  const draft = async (e: ProductEvaluation) => {
    const r = await run('Create draft', (c) => c.createDraft(e.productId, purpose, 'user'), { success: 'Draft created. Nothing has been submitted.' });
    if (r) navigate('/applications');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financing comparison"
        description={
          <>
            Options are compared for the same required net cash: <strong>{formatBDT(comparison.fundingGapMinor)}</strong>
            {comparison.earliestNegativeDate ? <> needed by {comparison.earliestNegativeDate}</> : null}. Catalog v{comparison.catalogVersion}.
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit catalog
            </Button>
            <Button onClick={() => run('Compare financing', (c) => c.compareFinancing('user'), { success: 'Comparison logged to activity.' })} disabled={busy}>
              Run and log comparison
            </Button>
          </>
        }
      />
      <Alert variant={comparison.bestFitProductId ? 'success' : 'warning'}>
        <div>{comparison.notes.join(' ')}</div>
      </Alert>
      <Card>
        <Table>
          <caption className="sr-only">Financing options compared</caption>
          <THead>
            <tr>
              <TH>#</TH>
              <TH>Option</TH>
              <TH>Result</TH>
              <TH className="text-right">Principal / net cash</TH>
              <TH className="text-right">Modeled cost</TH>
              <TH>Repayment</TH>
              <TH>
                <span className="sr-only">Action</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {comparison.evaluations.map((e) => {
              const p = catalogById.get(e.productId);
              return (
                <TR key={e.productId}>
                  <TD className="font-semibold">{e.rank ?? '—'}</TD>
                  <TD className="min-w-44 max-w-56">
                    <div className="font-medium">{e.productName}</div>
                    <div className="text-xs text-stone-600">{e.provider}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <Badge variant={e.classification === 'sandbox_product' ? 'neutral' : 'info'}>{e.classification === 'sandbox_product' ? 'Sandbox product' : 'Public reference'}</Badge>
                      {p ? <Terms p={p} /> : null}
                    </div>
                  </TD>
                  <TD className="min-w-52 max-w-72">
                    <StatusBadge status={e.status} />
                    <ul className="mt-1 space-y-0.5 text-xs text-stone-700">
                      {e.reasons.map((r) => (
                        <li key={r}>
                          <code className="text-[10px] text-stone-500">{r}</code> {REASON_TEXT[r]}
                          {r === 'MISSING_EVIDENCE' && e.missingEvidence.length ? ` (${e.missingEvidence.join(', ')})` : ''}
                        </li>
                      ))}
                    </ul>
                  </TD>
                  {e.quote ? (
                    <>
                      <TD className="text-right text-xs">
                        <Money value={e.quote.principalMinor} className="text-sm font-medium" />
                        <div className="text-stone-600">
                          net <Money value={e.quote.netCashReceivedMinor} />
                        </div>
                      </TD>
                      <TD className="text-right text-xs">
                        <Money value={e.quote.totalFinancingCostMinor} className="text-sm font-semibold" />
                        <div className="text-stone-600">
                          fee <Money value={e.quote.feeMinor} />
                        </div>
                        <div className="text-stone-600">
                          interest <Money value={e.quote.interestMinor} />
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap text-xs">
                        <Money value={e.quote.maturityRepaymentMinor} className="text-sm font-medium" />
                        <div className="text-stone-600">funds {e.disbursementDate}</div>
                        <div className="text-stone-600">due {e.maturityDate}</div>
                      </TD>
                    </>
                  ) : (
                    <TD colSpan={3} className="text-center text-xs text-stone-500">
                      Not costed: terms incomplete or ineligible
                    </TD>
                  )}
                  <TD>
                    {e.status === 'fits' ? (
                      <Button size="sm" onClick={() => draft(e)} disabled={busy}>
                        Draft application
                      </Button>
                    ) : null}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Draft settings</CardTitle>
            <CardDescription>Drafting saves an application only. It does not submit anything.</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor="purpose">Purpose stated in the draft</Label>
            <Input id="purpose" value={purpose} maxLength={200} onChange={(e) => setPurpose(e.target.value)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Method and assumptions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
              {comparison.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <TruthNote>{TRUTH_LABELS.financing} Ranking only covers options with complete, comparable terms; “lowest modeled cost” is never a claim of the universally best product.</TruthNote>
      {editing ? <CatalogEditor onClose={() => setEditing(false)} /> : null}
    </div>
  );
}

function Terms({ p }: { p: FinancingProduct }) {
  const parts = [
    p.annualSimpleRateBps === null ? 'rate ?' : `${(p.annualSimpleRateBps / 100).toFixed(2)}% p.a.`,
    p.upfrontFeeBps === null ? 'fee ?' : `${(p.upfrontFeeBps / 100).toFixed(2)}% fee`,
    p.upfrontFixedFeeMinor && p.upfrontFixedFeeMinor !== '0' ? `+ ${formatBDT(p.upfrontFixedFeeMinor)}` : null,
    p.termDays === null ? 'term ?' : `${p.termDays} d`,
    `${p.disbursementDelayDays} d delay`,
  ].filter(Boolean);
  return (
    <span className="text-[11px] text-stone-600">
      {parts.join(' · ')}
      {p.sourceUrl ? (
        <a href={p.sourceUrl} className="ml-1 inline-flex items-center gap-0.5 underline" target="_blank" rel="noreferrer">
          source <ExternalLink className="size-3" aria-hidden />
        </a>
      ) : null}
    </span>
  );
}
