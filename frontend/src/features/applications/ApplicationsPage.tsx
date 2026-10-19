import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, FileText, Printer, X } from 'lucide-react';
import { DESTINATION, formatCivilDate, type ApplicationDraft, type PendingAction } from '@farmlink/engine';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { EmptyState, Money, PageHeader, StatusBadge, TruthNote } from '@/components/common';
import { useSandbox } from '@/state/SandboxProvider';
import { RequireWorkspace } from '@/app/RequireWorkspace';
import { ReviewDialog } from './ReviewDialog';
import { ReceiptCard } from './ReceiptCard';
import { cn } from '@/lib/utils';

export function ApplicationsPage() {
  return (
    <RequireWorkspace>
      <ApplicationsInner />
    </RequireWorkspace>
  );
}

function ApplicationsInner() {
  const { snapshot } = useSandbox();
  const apps = snapshot!.applications;
  const [reviewAction, setReviewAction] = useState<PendingAction | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 5 · Apply"
        title="Applications"
        description={
          <>
            Drafts become sandbox submissions only after you review the exact terms and confirm. Destination: <strong>{DESTINATION}</strong>.
          </>
        }
      />
      {!apps.length ? (
        <EmptyState
          title="No applications yet"
          icon={FileText}
          action={
            <Link to="/financing" className={buttonVariants()}>
              Compare financing options
            </Link>
          }
        >
          Draft an application from an option that fits the stated sandbox rules.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {apps.map((a) => (
            <ApplicationCard
              key={a.id}
              app={a}
              action={snapshot!.actions.find((x) => x.id === a.pendingActionId) ?? null}
              onReview={(act) => {
                setReviewAction(act);
                setOpen(true);
              }}
            />
          ))}
        </div>
      )}
      <TruthNote>SANDBOX_SUBMITTED means the internal simulator received the application. It does not mean approved, paid, sent to a real institution, or cryptographically verified.</TruthNote>
      <ReviewDialog action={reviewAction} open={open} onOpenChange={setOpen} />
    </div>
  );
}

const STEPS = [
  { key: 'draft', label: 'Draft saved' },
  { key: 'review', label: 'Exact terms frozen' },
  { key: 'confirm', label: 'You confirmed' },
];

function stepIndex(status: ApplicationDraft['status']): number {
  if (status === 'SANDBOX_SUBMITTED') return 3;
  if (status === 'AWAITING_CONFIRMATION') return 1;
  return 0;
}

function Stepper({ status }: { status: ApplicationDraft['status'] }) {
  const idx = stepIndex(status);
  const stopped = status === 'CANCELLED' || status === 'EXPIRED';
  return (
    <ol className="flex items-center gap-2" aria-label="Application progress">
      {STEPS.map((s, i) => {
        const done = i < idx || (i === 0 && !stopped);
        const current = i === idx && !stopped && idx < 3;
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold',
                done ? 'bg-brand-600 text-white' : current ? 'bg-harvest-100 text-amber-900 ring-2 ring-harvest-400' : 'bg-stone-100 text-stone-500',
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : stopped && i === idx ? <X className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className={cn('hidden text-xs sm:block', done || current ? 'font-medium text-stone-800' : 'text-stone-500')}>{s.label}</span>
            {i < STEPS.length - 1 ? <span className={cn('h-0.5 flex-1 rounded', i < idx ? 'bg-brand-500' : 'bg-stone-200')} aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function ApplicationCard({ app, action, onReview }: { app: ApplicationDraft; action: PendingAction | null; onReview: (a: PendingAction) => void }) {
  const { run, busy } = useSandbox();
  const [purpose, setPurpose] = useState(app.purpose);
  const editable = app.status !== 'SANDBOX_SUBMITTED' && app.status !== 'CANCELLED';

  const prepare = async () => {
    const act = await run('Prepare submission', (c) => c.prepare(app.id, 'user'));
    if (act) onReview(act);
  };

  return (
    <Card data-testid="application-card" className={cn(app.status === 'SANDBOX_SUBMITTED' && 'ring-1 ring-emerald-200')}>
      <CardContent className="space-y-5 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{app.productName}</h2>
              <StatusBadge status={app.status} />
            </div>
            <p className="mt-0.5 text-sm text-stone-500">
              {app.provider} · created {new Date(app.createdAt).toLocaleString()} by {app.createdBy === 'model' ? 'the AI copilot (proposal)' : 'you'} · draft v{app.version}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="no-print" onClick={() => window.print()}>
            <Printer aria-hidden /> Print / PDF
          </Button>
        </div>

        <Stepper status={app.status} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
          <KV k="Borrow" v={<Money value={app.quote.principalMinor} decimals={false} approx="below" />} />
          <KV k="You receive" v={<Money value={app.quote.netCashReceivedMinor} decimals={false} />} />
          <KV k="Fee" v={<Money value={app.quote.feeMinor} decimals={false} />} />
          <KV k="Interest" v={<Money value={app.quote.interestMinor} decimals={false} />} />
          <KV k="Repay" v={<Money value={app.quote.maturityRepaymentMinor} decimals={false} />} />
          <KV k="Funds → due" v={`${formatCivilDate(app.disbursementDate)} → ${formatCivilDate(app.maturityDate)}`} />
        </div>

        {editable ? (
          <div className="no-print flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor={`p-${app.id}`}>Purpose</Label>
              <Input id={`p-${app.id}`} className="mt-1" value={purpose} maxLength={200} onChange={(e) => setPurpose(e.target.value)} />
            </div>
            <Button variant="outline" disabled={busy || purpose === app.purpose} onClick={() => run('Edit draft', (c) => c.updateDraftPurpose(app.id, purpose), { success: 'Draft updated; review again before confirming.' })}>
              Save edit
            </Button>
          </div>
        ) : (
          <p className="text-sm">
            <span className="text-stone-500">Purpose:</span> {app.purpose}
          </p>
        )}

        <div className="no-print flex flex-wrap gap-2">
          {app.status === 'AWAITING_CONFIRMATION' && action?.status === 'pending' ? (
            <>
              <Button onClick={() => onReview(action)}>Review and confirm</Button>
              <Button variant="outline" onClick={() => run('Cancel', (c) => c.cancel(action.id), { success: 'Pending submission cancelled.' })} disabled={busy}>
                Cancel
              </Button>
            </>
          ) : null}
          {app.status === 'DRAFT' || app.status === 'EXPIRED' ? (
            <Button onClick={prepare} disabled={busy}>
              Review exact terms
            </Button>
          ) : null}
        </div>
        {app.receipt ? <ReceiptCard receipt={app.receipt} /> : null}
      </CardContent>
    </Card>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-2.5">
      <div className="text-xs text-stone-500">{k}</div>
      <div className="mt-0.5 text-sm font-semibold">{v}</div>
    </div>
  );
}
