import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Award, CalendarCheck2, ChevronDown, ExternalLink, Settings2, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import {
  REASON_TEXT,
  TRUTH_LABELS,
  formatCivilDate,
  stressTestOption,
  toBig,
  type FinancingProduct,
  type ProductEvaluation,
  type StressReport,
} from '@farmlink/engine';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Money, PageHeader, StatusBadge, TruthNote } from '@/components/common';
import { useSandbox } from '@/state/SandboxProvider';
import { useMoney } from '@/lib/money';
import { useMarkVisited } from '@/lib/journey';
import { RequireWorkspace } from '@/app/RequireWorkspace';
import { CatalogEditor } from './CatalogEditor';
import { cn } from '@/lib/utils';
import { GLOSSARY, Term } from '@/components/Term';
import { AnimatePresence, motion } from '@/components/motion';

export function FinancingPage() {
  return (
    <RequireWorkspace>
      <FinancingInner />
    </RequireWorkspace>
  );
}

type Filter = 'all' | 'fits' | 'needs_information' | 'does_not_fit';

function FinancingInner() {
  const { comparison, snapshot, derivedError, run, busy } = useSandbox();
  const { fmt, approx } = useMoney();
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState(false);
  const [drafting, setDrafting] = useState<ProductEvaluation | null>(null);
  useMarkVisited('/financing', !!comparison);
  const ws = snapshot!.workspace!;
  const catalogById = useMemo(() => new Map(snapshot!.catalog.map((p) => [p.id, p])), [snapshot]);
  const stress = useMemo(() => {
    const m = new Map<string, StressReport>();
    if (!comparison) return m;
    for (const e of comparison.evaluations) {
      if (e.status === 'fits') {
        const r = stressTestOption(ws, snapshot!.events, e);
        if (r) m.set(e.productId, r);
      }
    }
    return m;
  }, [comparison, ws, snapshot]);
  if (derivedError) return <Alert variant="danger">{derivedError}</Alert>;
  if (!comparison) return null;

  const counts = {
    all: comparison.evaluations.length,
    fits: comparison.evaluations.filter((e) => e.status === 'fits').length,
    needs_information: comparison.evaluations.filter((e) => e.status === 'needs_information').length,
    does_not_fit: comparison.evaluations.filter((e) => e.status === 'does_not_fit').length,
  };
  const shown = comparison.evaluations.filter((e) => filter === 'all' || e.status === filter);
  const maxCost = comparison.evaluations.reduce((m, e) => (e.quote && toBig(e.quote.totalFinancingCostMinor) > m ? toBig(e.quote.totalFinancingCostMinor) : m), 1n);
  const target = ws.financingTarget ?? 'gap';
  const need = comparison.requiredNetCashMinor;

  const setTarget = (t: 'gap' | 'gap_plus_buffer') =>
    run('Update financing target', (c) => c.saveWorkspace({ ...ws, financingTarget: t }), {
      success: t === 'gap_plus_buffer' ? 'Now sizing financing to keep your minimum buffer.' : 'Now sizing financing to the gap only.',
    });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 4 · Financing"
        title="Financing options"
        description="Every option is sized to the same need, checked for timing and repayment, and explained. Nothing here is an offer or approval."
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Settings2 aria-hidden /> Edit catalog
            </Button>
            <Button variant="outline" onClick={() => run('Compare financing', (c) => c.compareFinancing('user'), { success: 'Comparison recorded in Activity.' })} disabled={busy}>
              Record comparison
            </Button>
          </>
        }
      />

      <section className="grid gap-4 rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-stone-200/80 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">You need to raise</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <span className="text-3xl font-semibold tracking-tight">{fmt(need, { decimals: false })}</span>
            {approx(need) ? <span className="text-sm text-stone-500">{approx(need)}</span> : null}
          </div>
          <p className="mt-1 text-sm text-stone-600">
            {comparison.earliestNegativeDate ? (
              <>
                in net cash, available by <strong>{formatCivilDate(comparison.earliestNegativeDate)}</strong> (first negative day).
              </>
            ) : (
              'No shortfall is projected.'
            )}
          </p>
        </div>
        <fieldset className="rounded-2xl bg-stone-50 p-1.5">
          <legend className="sr-only">Amount to borrow</legend>
          <div className="grid grid-cols-2 gap-1 text-sm">
            {(
              [
                ['gap', 'Cover the gap', 'Lowest amount; no safety margin'],
                ['gap_plus_buffer', 'Gap + buffer', `Keeps ${fmt(ws.minimumCashBufferMinor, { decimals: false })} cushion`],
              ] as const
            ).map(([v, l, d]) => (
              <button
                key={v}
                className={cn('rounded-xl px-3 py-2 text-left transition-colors', target === v ? 'bg-white shadow-sm ring-1 ring-stone-200' : 'text-stone-600 hover:bg-white/60')}
                aria-pressed={target === v}
                disabled={busy}
                onClick={() => target !== v && setTarget(v)}
              >
                <div className="font-medium">{l}</div>
                <div className="text-xs text-stone-500">{d}</div>
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <Alert variant={comparison.bestFitProductId ? 'success' : 'warning'}>
        <Award aria-hidden />
        <div>{comparison.notes.join(' ')}</div>
      </Alert>

      <div role="tablist" aria-label="Filter options" className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'All'],
            ['fits', 'Fits'],
            ['needs_information', 'Needs info'],
            ['does_not_fit', 'Does not fit'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={filter === k}
            onClick={() => setFilter(k)}
            className={cn('relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors', filter === k ? 'text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50')}
          >
            {filter === k ? <motion.span layoutId="fin-filter" className="absolute inset-0 rounded-full bg-brand-800" transition={{ type: 'spring', stiffness: 400, damping: 32 }} /> : null}
            <span className="relative">
              {l} <span className={cn('ml-1 rounded-full px-1.5 text-xs', filter === k ? 'bg-white/20' : 'bg-stone-100')}>{counts[k]}</span>
            </span>
          </button>
        ))}
      </div>

      <motion.div layout className="grid gap-4">
        <AnimatePresence mode="popLayout" initial={false}>
        {shown.map((e, i) => (
          <motion.div
            key={e.productId}
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 6) * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
          >
          <OptionCard
            key={e.productId}
            e={e}
            p={catalogById.get(e.productId)}
            best={e.productId === comparison.bestFitProductId}
            maxCost={maxCost}
            stress={stress.get(e.productId) ?? null}
            onDraft={() => setDrafting(e)}
          />
          </motion.div>
        ))}
        </AnimatePresence>
      </motion.div>

      <details className="rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-stone-200/80">
        <summary className="cursor-pointer text-sm font-semibold">Method and assumptions</summary>
        <ul className="mt-3 space-y-1.5 text-sm text-stone-700">
          {comparison.assumptions.map((a) => (
            <li key={a} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
              {a}
            </li>
          ))}
          <li className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-violet-400" aria-hidden />
            Stress test: the drafted loan is held fixed (amount, funding date, due date) while planned sales and costs are stressed. Pass means cash never goes below zero through
            maturity.
          </li>
        </ul>
      </details>
      <TruthNote>{TRUTH_LABELS.financing} “Lowest modeled cost” is never a claim of the universally best product.</TruthNote>
      {editing ? <CatalogEditor onClose={() => setEditing(false)} /> : null}
      <DraftDialog evaluation={drafting} onClose={() => setDrafting(null)} />
    </div>
  );
}

function OptionCard({
  e,
  p,
  best,
  maxCost,
  stress,
  onDraft,
}: {
  e: ProductEvaluation;
  p: FinancingProduct | undefined;
  best: boolean;
  maxCost: bigint;
  stress: StressReport | null;
  onDraft: () => void;
}) {
  const { busy } = useSandbox();
  const fits = e.status === 'fits';
  const q = e.quote;
  const feePct = q ? Number((toBig(q.feeMinor) * 1000n) / maxCost) / 10 : 0;
  const intPct = q ? Number((toBig(q.interestMinor) * 1000n) / maxCost) / 10 : 0;
  return (
    <Card className={cn('lift overflow-hidden', best && 'ring-2 ring-brand-400', !fits && 'bg-white/70')}>
      {best ? (
        <div className="flex items-center gap-2 bg-brand-gradient px-5 py-2 text-xs font-semibold text-white">
          <Award className="size-4 text-harvest-400" aria-hidden /> Lowest modeled cost among the options provided
        </div>
      ) : null}
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {e.rank ? <span className="grid size-6 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">{e.rank}</span> : null}
              <h3 className="text-base font-semibold">{e.productName}</h3>
              <StatusBadge status={e.status} />
            </div>
            <div className="mt-0.5 text-sm text-stone-500">
              {e.provider} · {e.classification === 'sandbox_product' ? 'sandbox product' : 'public reference'}
            </div>
            {p ? <Terms p={p} /> : null}
          </div>
          {fits ? (
            <Button onClick={onDraft} disabled={busy}>
              Draft application <ArrowRight aria-hidden />
            </Button>
          ) : null}
        </div>

        {q ? (
          <div className="rounded-2xl bg-stone-50 p-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
              <KV k="Borrow" v={<Money value={q.principalMinor} decimals={false} approx="below" />} />
              <KV k={<Term tip={GLOSSARY.netCash}>You receive</Term>} v={<Money value={q.netCashReceivedMinor} decimals={false} />} />
              <KV k={<Term tip={GLOSSARY.totalCost}>Total cost</Term>} v={<Money value={q.totalFinancingCostMinor} decimals={false} approx="below" />} strong />
              <KV k={e.maturityDate ? `Repay on ${formatCivilDate(e.maturityDate)}` : 'Repay'} v={<Money value={q.maturityRepaymentMinor} decimals={false} />} />
            </dl>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-stone-200/70" aria-hidden>
              <div className="bg-harvest-400" style={{ width: `${feePct}%` }} />
              <div className="bg-brand-500" style={{ width: `${intPct}%` }} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
              <span>
                <span className="mr-1 inline-block size-2 rounded-full bg-harvest-400" aria-hidden />
                Fee <Money value={q.feeMinor} decimals={false} />
              </span>
              <span>
                <span className="mr-1 inline-block size-2 rounded-full bg-brand-500" aria-hidden />
                Interest <Money value={q.interestMinor} decimals={false} />
              </span>
              {e.disbursementDate ? (
                <span className="inline-flex items-center gap-1">
                  <CalendarCheck2 className="size-3" aria-hidden /> Funds arrive {formatCivilDate(e.disbursementDate)}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-500">Not costed: terms are incomplete or the option is ineligible.</p>
        )}

        {e.reasons.length ? (
          <ul className="space-y-1.5">
            {e.reasons.map((r) => (
              <li key={r} className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-stone-700">
                <code className="h-fit shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-600">{r}</code>
                <span className="min-w-0 flex-1">
                  {REASON_TEXT[r]}
                  {r === 'MISSING_EVIDENCE' && e.missingEvidence.length ? ` (${e.missingEvidence.join(', ').replace(/_/g, ' ')})` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {stress ? <StressPanel report={stress} productId={e.productId} /> : null}
      </CardContent>
    </Card>
  );
}

function StressPanel({ report, productId }: { report: StressReport; productId: string }) {
  const { run, busy } = useSandbox();
  const [open, setOpen] = useState(false);
  const Icon = report.verdict === 'resilient' ? ShieldCheck : report.verdict === 'fragile' ? ShieldAlert : ShieldQuestion;
  const color = report.verdict === 'resilient' ? 'text-emerald-700 bg-emerald-50' : report.verdict === 'fragile' ? 'text-red-700 bg-red-50' : 'text-amber-800 bg-amber-50';
  return (
    <div className="rounded-xl border border-stone-200">
      <button className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5 text-left text-sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className={cn('grid size-6 place-items-center rounded-lg', color)}>
          <Icon className="size-3.5" aria-hidden />
        </span>
        <span className="font-medium">Repayment stress test</span>
        <span className="text-stone-500">
          survives {report.passed} of {report.total} scenarios
        </span>
        <ChevronDown className={cn('ml-auto size-4 text-stone-400 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
      {open ? (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden border-t border-stone-100 px-3 py-2">
          <ul className="space-y-1.5 text-sm">
            {report.results.map((r) => (
              <li key={r.scenarioId} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className={cn('size-2 shrink-0 rounded-full', r.passes ? 'bg-emerald-500' : 'bg-red-500')} aria-hidden />
                <span className="min-w-40 flex-1">{r.label}</span>
                <span className="text-xs text-stone-500">{r.passes ? 'stays ≥ 0' : 'goes negative'}</span>
                <Money value={r.minClosingWithFinancingMinor} decimals={false} className="text-xs font-medium" />
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-stone-500">
              Lowest cash with this loan in place, under each scenario. <Term tip={GLOSSARY.stress}>How it works</Term>
            </p>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run('Stress test', (c) => c.stressTest(productId, 'user'), { success: 'Stress test recorded in Activity.' })}>
              Record result
            </Button>
          </div>
        </motion.div>
      ) : null}
      </AnimatePresence>
    </div>
  );
}

function KV({ k, v, strong }: { k: React.ReactNode; v: React.ReactNode; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-stone-500">{k}</dt>
      <dd className={cn('mt-0.5 text-sm', strong ? 'font-semibold text-stone-900' : 'font-medium')}>{v}</dd>
    </div>
  );
}

function Terms({ p }: { p: FinancingProduct }) {
  const { fmt } = useMoney();
  const parts = [
    p.annualSimpleRateBps === null ? 'rate unknown' : `${(p.annualSimpleRateBps / 100).toFixed(2)}% a year`,
    p.upfrontFeeBps === null ? 'fee unknown' : `${(p.upfrontFeeBps / 100).toFixed(2)}% fee`,
    p.upfrontFixedFeeMinor && p.upfrontFixedFeeMinor !== '0' ? `+ ${fmt(p.upfrontFixedFeeMinor, { decimals: false })}` : null,
    p.termDays === null ? 'term unknown' : `${p.termDays}-day term`,
    `funds in ${p.disbursementDelayDays} d`,
  ].filter(Boolean);
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {parts.map((t) => (
        <span key={t} className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-600">
          {t}
        </span>
      ))}
      {p.sourceUrl ? (
        <a href={p.sourceUrl} className="inline-flex items-center gap-0.5 text-[11px] text-brand-700 underline" target="_blank" rel="noreferrer">
          source <ExternalLink className="size-3" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}

function DraftDialog({ evaluation, onClose }: { evaluation: ProductEvaluation | null; onClose: () => void }) {
  const { run, busy } = useSandbox();
  const navigate = useNavigate();
  const [purpose, setPurpose] = useState('Seasonal working capital for seed and fertilizer before harvest');
  if (!evaluation?.quote) return null;
  const q = evaluation.quote;
  const create = async () => {
    const r = await run('Create draft', (c) => c.createDraft(evaluation.productId, purpose, 'user'), { success: 'Draft saved. Nothing has been submitted.' });
    if (r) {
      onClose();
      navigate('/applications');
    }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Draft an application</DialogTitle>
          <DialogDescription>Drafting saves the application only. You will review the exact details before anything is sent to the sandbox simulator.</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-stone-50 p-4 text-sm">
          <div className="font-semibold">{evaluation.productName}</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <KV k="Borrow" v={<Money value={q.principalMinor} decimals={false} />} />
            <KV k="Total cost" v={<Money value={q.totalFinancingCostMinor} decimals={false} />} />
            <KV k="Funds" v={evaluation.disbursementDate ? formatCivilDate(evaluation.disbursementDate) : '—'} />
            <KV k="Repay" v={evaluation.maturityDate ? formatCivilDate(evaluation.maturityDate) : '—'} />
          </div>
        </div>
        <div>
          <Label htmlFor="draft-purpose">Purpose (shared with the simulator)</Label>
          <Input id="draft-purpose" className="mt-1" value={purpose} maxLength={200} onChange={(e) => setPurpose(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={create} disabled={busy}>
            Save draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
