import { useMemo, useState } from 'react';
import { Bot, CheckCircle2, Download, Hand, OctagonX, ShieldAlert, User, Wrench } from 'lucide-react';
import { TRUTH_LABELS, type ToolEvent } from '@farmlink/engine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, ModeBadge, PageHeader, StatusBadge, TruthNote } from '@/components/common';
import { useSandbox } from '@/state/SandboxProvider';
import { downloadText } from '@/lib/utils';
import { cn } from '@/lib/utils';

const ACTOR_ICON = { user: User, guided: Wrench, model: Bot, system: Wrench } as const;
const POLICY_STYLE: Record<ToolEvent['policy'], { icon: typeof CheckCircle2; cls: string }> = {
  allowed: { icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  requires_confirmation: { icon: Hand, cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  rejected: { icon: OctagonX, cls: 'bg-red-50 text-red-700 ring-red-200' },
  error: { icon: ShieldAlert, cls: 'bg-red-50 text-red-700 ring-red-200' },
};

type Filter = 'all' | 'model' | 'rejected';

export function ActivityPage() {
  const { snapshot, client, run, busy } = useSandbox();
  const [redact, setRedact] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const events = useMemo(() => {
    const all = [...(snapshot?.toolEvents ?? [])].reverse();
    return all.filter((e) => filter === 'all' || (filter === 'model' ? e.actor === 'model' : e.policy === 'rejected' || e.policy === 'error'));
  }, [snapshot, filter]);
  const counts = useMemo(() => {
    const t = snapshot?.toolEvents ?? [];
    return { total: t.length, rejected: t.filter((e) => e.policy === 'rejected' || e.policy === 'error').length, model: t.filter((e) => e.actor === 'model').length };
  }, [snapshot]);

  const exportBundle = async () => {
    const b = await run('Export evidence', (c) => c.exportEvidence(redact), { success: 'Evidence bundle downloaded.' });
    if (b) downloadText(`farmlink-evidence-${b.mode}-${b.generatedAt.replace(/[:.]/g, '-')}.json`, JSON.stringify(b, null, 2));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Audit"
        title="Activity and evidence"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            Every action and tool call, including what was blocked. Mode: <ModeBadge mode={client.mode} />
          </span>
        }
        actions={
          <>
            <label className="flex items-center gap-2 rounded-lg px-2 text-sm text-stone-600">
              <input type="checkbox" checked={redact} onChange={(e) => setRedact(e.target.checked)} /> Redact business name
            </label>
            <Button onClick={exportBundle} disabled={busy || !snapshot?.workspace}>
              <Download aria-hidden /> Export evidence bundle
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Events recorded', counts.total, 'text-stone-900'],
          ['Model tool calls', counts.model, 'text-sky-800'],
          ['Blocked or failed', counts.rejected, 'text-red-700'],
        ].map(([k, v, c]) => (
          <div key={k as string} className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-stone-200/80">
            <div className="text-xs font-medium text-stone-500">{k}</div>
            <div className={cn('mt-1 text-2xl font-semibold', c as string)}>{v}</div>
          </div>
        ))}
      </div>

      {snapshot?.runs.length ? (
        <Card>
          <CardHeader>
            <CardTitle>AI copilot runs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-stone-100">
              {[...snapshot.runs].reverse().map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                  <StatusBadge status={r.status} />
                  <span className="min-w-0 flex-1 truncate">“{r.userMessage}”</span>
                  <span className="text-xs text-stone-500">
                    {r.modelId} · {r.roundTrips} round trips · {r.toolCalls} tool calls
                  </span>
                  <code className="text-[11px] text-stone-400">{r.id}</code>
                  {r.error ? <div className="w-full text-xs text-red-700">{r.error}</div> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div role="tablist" aria-label="Filter events" className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'All events'],
            ['model', 'AI tool calls'],
            ['rejected', 'Blocked / failed'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            role="tab"
            aria-selected={filter === k}
            onClick={() => setFilter(k)}
            className={cn('rounded-full px-3.5 py-1.5 text-sm font-medium', filter === k ? 'bg-brand-800 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50')}
          >
            {l}
          </button>
        ))}
      </div>

      {!events.length ? (
        <EmptyState title="Nothing here yet">Actions you take and tools the copilot runs will appear as a timeline.</EmptyState>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <ol className="relative space-y-4 border-l-2 border-stone-100 pl-6">
              {events.map((e) => {
                const P = POLICY_STYLE[e.policy];
                const A = ACTOR_ICON[e.actor];
                return (
                  <li key={e.id} className="relative">
                    <span className={cn('absolute -left-[35px] top-0 grid size-7 place-items-center rounded-full ring-2 ring-white', P.cls)}>
                      <P.icon className="size-3.5" aria-hidden />
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded-md bg-stone-100 px-1.5 py-0.5 text-xs font-semibold text-stone-700">{e.tool}</code>
                      <StatusBadge status={e.policy} />
                      <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                        <A className="size-3" aria-hidden /> {e.actor === 'guided' ? 'guided button' : e.actor}
                      </span>
                      <span className="ml-auto font-mono text-[11px] text-stone-400">{e.at.replace('T', ' ').slice(0, 19)} UTC</span>
                    </div>
                    <p className="mt-1 text-sm text-stone-700">{e.outcome}</p>
                    {Object.keys(e.args).length ? <p className="mt-0.5 break-all font-mono text-[11px] text-stone-400">{JSON.stringify(e.args)}</p> : null}
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
      <TruthNote>{client.mode === 'guided_local' ? TRUTH_LABELS.localLogs : TRUTH_LABELS.serverLogs}</TruthNote>
    </div>
  );
}
