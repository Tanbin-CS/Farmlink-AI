import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Bot, FileCheck2, Landmark, Loader2, Send, Wrench } from 'lucide-react';
import {
  REASON_TEXT,
  type CashflowResult,
  type FinancingComparison,
  type PendingAction,
  type StressReport,
  type ToolEvent,
} from '@farmlink/engine';
import { useSandbox } from '@/state/SandboxProvider';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { ModeBadge, StatusBadge, TruthNote } from '@/components/common';
import { ReviewDialog } from '@/features/applications/ReviewDialog';
import type { ChatTurn } from '@/services/types';
import { cn } from '@/lib/utils';
import { useMoney } from '@/lib/money';
import { DemoLauncher } from '@/components/DemoLauncher';
import { motion } from '@/components/motion';

export function CopilotPanel() {
  const { client, snapshot } = useSandbox();
  const [view, setView] = useState<'chat' | 'tools'>('chat');
  const live = !!client.runAgent;
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-card)] ring-1 ring-stone-200/80">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 bg-gradient-to-r from-brand-50 to-white px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-xl bg-brand-gradient text-white shadow-sm">
            <Bot className="size-4" aria-hidden />
          </span>
          <div className="leading-tight">
            <h2 className="text-sm font-semibold">Copilot</h2>
            <p className="text-[11px] text-stone-500">Prepares, never submits</p>
          </div>
        </div>
        <ModeBadge mode={client.mode} />
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain p-4" data-lenis-prevent>
        {live && snapshot?.workspace ? (
          <div role="tablist" aria-label="Copilot view" className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1 text-sm">
            {(['chat', 'tools'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                className={cn('rounded-md px-2 py-1', view === v ? 'bg-white font-medium shadow-sm' : 'text-stone-600')}
                onClick={() => setView(v)}
              >
                {v === 'chat' ? 'AI chat' : 'Explicit tools'}
              </button>
            ))}
          </div>
        ) : null}
        {!snapshot?.workspace ? <NoWorkspace /> : live && view === 'chat' ? <LiveChat /> : <GuidedSteps />}
      </div>
    </section>
  );
}

function NoWorkspace() {
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-xl bg-brand-50 p-3 text-brand-950">
        Hi! I help cooperatives plan cash and financing. Start with the fictional demo, which runs short of cash before harvest, or set up your own business.
      </div>
      <DemoLauncher className="w-full" />
      <Link to="/setup" className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}>
        Set up my own business
      </Link>
    </div>
  );
}

function GuidedSteps() {
  const { run, busy, snapshot, client } = useSandbox();
  const { fmt } = useMoney();
  const [cash, setCash] = useState<CashflowResult | null>(null);
  const [cmp, setCmp] = useState<FinancingComparison | null>(null);
  const [stress, setStress] = useState<StressReport | null>(null);
  const [productId, setProductId] = useState('');
  const [purpose, setPurpose] = useState('Seasonal working capital for seed and fertilizer before harvest');
  const [action, setAction] = useState<PendingAction | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const fits = cmp?.evaluations.filter((e) => e.status === 'fits') ?? [];
  const selected = productId || cmp?.bestFitProductId || '';

  const analyze = async () => {
    const r = await run('Analyze cash flow', (c) => c.analyzeCashflow('guided'));
    if (r) setCash(r);
  };
  const compare = async () => {
    const r = await run('Compare financing', (c) => c.compareFinancing('guided'));
    if (r) {
      setCmp(r);
      setStress(r.bestFitProductId ? ((await run('Stress test', (c) => c.stressTest(r.bestFitProductId!, 'guided'), { silent: true })) ?? null) : null);
    }
  };
  const prepare = async () => {
    if (!selected) return;
    const draft = await run('Create draft', (c) => c.createDraft(selected, purpose, 'guided'));
    if (!draft) return;
    const act = await run('Prepare submission', (c) => c.prepare(draft.id, 'guided'));
    if (act) {
      setAction(act);
      setReviewOpen(true);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <Alert variant="neutral">
        <Wrench aria-hidden />
        {client.mode === 'guided_local' ? (
          <div>
            <strong>Guided sandbox — no live AI.</strong> Each button runs a deterministic tool in this browser. Nothing here is generated by a language model.
          </div>
        ) : (
          <div>
            <strong>Explicit tools.</strong> These buttons call the same server tools the model uses, without any model involvement.
          </div>
        )}
      </Alert>

      <Step n={1} title="Analyze cash flow" icon={BarChart3}>
        <Button size="sm" onClick={analyze} disabled={busy}>
          Analyze cash flow
        </Button>
        {cash ? (
          <ResultBox>
            {cash.earliestNegativeDate ? (
              <>
                Cash is projected to go negative on <strong>{cash.earliestNegativeDate}</strong>. Largest shortfall:{' '}
                <strong>{fmt(cash.fundingGapMinor, { decimals: false })}</strong>. {cash.alerts.filter((a) => a.level === 'critical').length} critical day(s).
              </>
            ) : (
              <>
                No negative cash projected. Minimum balance {fmt(cash.minClosingMinor, { decimals: false })} on {cash.minClosingDate}.
              </>
            )}{' '}
            <Link className="text-brand-800 underline" to="/cashflow">
              Details
            </Link>
          </ResultBox>
        ) : null}
      </Step>

      <Step n={2} title="Compare financing" icon={Landmark}>
        <Button size="sm" onClick={compare} disabled={busy}>
          Compare financing
        </Button>
        {cmp ? (
          <ResultBox>
            <p>{cmp.notes[0]}</p>
            <ul className="mt-2 space-y-1">
              {cmp.evaluations.slice(0, 4).map((e) => (
                <li key={e.productId} className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={e.status} />
                  <span className="font-medium">{e.productName}</span>
                  {e.quote && e.status === 'fits' ? <span className="text-stone-600">cost {fmt(e.quote.totalFinancingCostMinor, { decimals: false })}</span> : null}
                  {e.reasons[0] && e.status !== 'fits' ? <span className="text-xs text-stone-600">{REASON_TEXT[e.reasons[0]]}</span> : null}
                </li>
              ))}
            </ul>
            {stress ? (
              <p className="mt-2 rounded-md bg-white p-2 text-xs">
                Stress test of the cheapest option: survives <strong>{stress.passed}</strong> of {stress.total} adverse scenarios ({stress.verdict.replace('_', ' ')}).
                {stress.passed < stress.total ? ' Consider borrowing enough to keep your buffer.' : ''}
              </p>
            ) : null}
            <Link className="mt-1 inline-block text-brand-800 underline" to="/financing">
              Full comparison
            </Link>
          </ResultBox>
        ) : null}
      </Step>

      <Step n={3} title="Prepare application" icon={FileCheck2}>
        {cmp ? (
          fits.length ? (
            <div className="space-y-2">
              <div>
                <Label htmlFor="copilot-product">Option</Label>
                <Select id="copilot-product" value={selected} onChange={(e) => setProductId(e.target.value)}>
                  {fits.map((e) => (
                    <option key={e.productId} value={e.productId}>
                      #{e.rank} {e.productName}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="copilot-purpose">Purpose</Label>
                <Input id="copilot-purpose" value={purpose} maxLength={200} onChange={(e) => setPurpose(e.target.value)} />
              </div>
              <Button size="sm" onClick={prepare} disabled={busy || !selected}>
                Create draft and review
              </Button>
            </div>
          ) : (
            <p className="text-stone-600">No option fits the stated sandbox rules, so nothing can be drafted.</p>
          )
        ) : (
          <p className="text-stone-600">Compare financing first.</p>
        )}
      </Step>

      <RecentEvents events={snapshot?.toolEvents ?? []} />
      <ReviewDialog action={action} open={reviewOpen} onOpenChange={setReviewOpen} />
    </div>
  );
}

function Step({ n, title, icon: Icon, children }: { n: number; title: string; icon: typeof BarChart3; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-200 p-3">
      <h3 className="mb-2 flex items-center gap-2 font-medium">
        <span className="grid size-5 place-items-center rounded-full bg-brand-900 text-[11px] text-white">{n}</span>
        <Icon className="size-4 text-stone-500" aria-hidden />
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ResultBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md bg-stone-50 p-2.5 text-[13px] leading-relaxed">{children}</div>;
}

function RecentEvents({ events }: { events: ToolEvent[] }) {
  const recent = events.slice(-6).reverse();
  if (!recent.length) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">Recent tool events</h3>
      <ol className="space-y-1">
        {recent.map((e) => (
          <li key={e.id} className="text-xs">
            <code className="rounded bg-stone-100 px-1">{e.tool}</code> <StatusBadge status={e.policy} /> <span className="text-stone-600">{e.outcome}</span>
          </li>
        ))}
      </ol>
      <Link to="/activity" className="text-xs text-brand-800 underline">
        All activity
      </Link>
    </div>
  );
}

interface ChatEntry {
  role: 'user' | 'assistant';
  text: string;
  runId?: string;
  status?: string;
  events?: ToolEvent[];
  pendingAction?: PendingAction | null;
  error?: boolean;
}

const SUGGESTIONS = [
  'When will we run short of cash, and by how much?',
  'Compare the financing options for our gap and explain the cheapest one.',
  'Prepare a sandbox application with the best option.',
];

function LiveChat() {
  const { client, refresh, switchToLocal } = useSandbox();
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const history = useMemo<ChatTurn[]>(() => entries.filter((e) => !e.error).map((e) => ({ role: e.role, text: e.text })).slice(-6), [entries]);

  const send = async (msg: string) => {
    const m = msg.trim();
    if (!m || pending || !client.runAgent) return;
    setEntries((x) => [...x, { role: 'user', text: m }]);
    setText('');
    setPending(true);
    try {
      const r = await client.runAgent(m, history);
      setEntries((x) => [
        ...x,
        { role: 'assistant', text: r.run.reply || '(no text reply)', runId: r.run.id, status: r.run.status, events: r.toolEvents, pendingAction: r.pendingAction },
      ]);
      await refresh();
    } catch (e) {
      setEntries((x) => [...x, { role: 'assistant', text: e instanceof Error ? e.message : 'The live agent failed.', error: true }]);
    } finally {
      setPending(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };

  return (
    <div className="flex h-full flex-col gap-3 text-sm">
      <TruthNote>Live model output is untrusted. Calculations, permissions, and submissions are enforced by server code; the model can only propose allowlisted tools and can never confirm a submission.</TruthNote>
      {!entries.length ? (
        <div className="space-y-2">
          <p className="text-stone-600">Try:</p>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="block w-full rounded-md border border-stone-200 px-3 py-2 text-left hover:bg-stone-50" onClick={() => void send(s)}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <ol className="space-y-3" aria-live="polite">
        {entries.map((e, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={cn('rounded-2xl p-3', e.role === 'user' ? 'ml-8 rounded-br-md bg-brand-700 text-white' : e.error ? 'border border-red-200 bg-red-50' : 'mr-4 rounded-bl-md border border-stone-200 bg-white')}
          >
            <div className={cn('mb-1 text-[11px] font-semibold uppercase tracking-wide', e.role === 'user' ? 'text-brand-100' : 'text-stone-500')}>
              {e.role === 'user' ? 'You' : e.error ? 'Error (no response invented)' : `Model · run ${e.runId?.slice(0, 10)} · ${e.status}`}
            </div>
            {/* Plain text only: model output is never rendered as HTML. */}
            <p className="whitespace-pre-wrap">{e.text}</p>
            {e.events?.length ? (
              <details className="mt-2" open>
                <summary className="cursor-pointer text-xs font-medium text-stone-600">Run timeline ({e.events.length} tool events)</summary>
                <ol className="mt-1 space-y-1 border-l-2 border-stone-200 pl-2">
                  {e.events.map((t) => (
                    <li key={t.id} className="text-xs">
                      <span className="text-stone-500">#{t.seq}</span> <code className="rounded bg-stone-100 px-1">{t.tool}</code> <StatusBadge status={t.policy} />
                      <div className="text-stone-600">{t.outcome}</div>
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
            {e.pendingAction ? (
              <Button
                size="sm"
                className="mt-2"
                onClick={() => {
                  setAction(e.pendingAction!);
                  setReviewOpen(true);
                }}
              >
                Review and confirm (human only)
              </Button>
            ) : null}
          </motion.li>
        ))}
      </ol>
      {pending ? (
        <div className="mr-8 flex items-center gap-3 rounded-2xl border border-stone-200 px-3 py-2.5 text-stone-600" role="status">
          <span className="flex gap-1" aria-hidden>
            <span className="typing-dot size-1.5 rounded-full bg-brand-600" />
            <span className="typing-dot size-1.5 rounded-full bg-brand-600 [animation-delay:150ms]" />
            <span className="typing-dot size-1.5 rounded-full bg-brand-600 [animation-delay:300ms]" />
          </span>
          <span className="text-xs">Thinking and running tools… (free hosting may need a cold start)</span>
          <Loader2 className="sr-only" aria-hidden />
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="sticky bottom-0 mt-auto flex gap-2 bg-white pt-2">
        <Label htmlFor="copilot-msg" className="sr-only">
          Message
        </Label>
        <Input id="copilot-msg" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Ask about cash flow or financing…" disabled={pending} />
        <Button type="submit" size="icon" aria-label="Send" disabled={pending || !text.trim()}>
          <Send />
        </Button>
      </form>
      <button className="text-left text-xs text-stone-600 underline" onClick={() => void switchToLocal()}>
        Switch back to guided sandbox (local data)
      </button>
      <ReviewDialog action={action} open={reviewOpen} onOpenChange={setReviewOpen} />
    </div>
  );
}
