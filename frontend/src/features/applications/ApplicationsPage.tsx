import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DESTINATION, type ApplicationDraft, type PendingAction } from '@farmlink/engine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { EmptyState, Money, PageHeader, StatusBadge, TruthNote } from '@/components/common';
import { useSandbox } from '@/state/SandboxProvider';
import { RequireWorkspace } from '@/app/RequireWorkspace';
import { ReviewDialog } from './ReviewDialog';
import { ReceiptCard } from './ReceiptCard';

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
        title="Applications"
        description={
          <>
            State machine: DRAFT → AWAITING_CONFIRMATION → SANDBOX_SUBMITTED (or CANCELLED / EXPIRED). Destination is always the <strong>{DESTINATION}</strong>.
          </>
        }
      />
      {!apps.length ? (
        <EmptyState
          title="No applications yet"
          action={
            <Link to="/financing" className={buttonVariants()}>
              Compare financing
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

function ApplicationCard({ app, action, onReview }: { app: ApplicationDraft; action: PendingAction | null; onReview: (a: PendingAction) => void }) {
  const { run, busy } = useSandbox();
  const [purpose, setPurpose] = useState(app.purpose);
  const editable = app.status !== 'SANDBOX_SUBMITTED' && app.status !== 'CANCELLED';

  const prepare = async () => {
    const act = await run('Prepare submission', (c) => c.prepare(app.id, 'user'));
    if (act) onReview(act);
  };

  return (
    <Card data-testid="application-card">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{app.productName}</CardTitle>
          <StatusBadge status={app.status} />
        </div>
        <CardDescription>
          {app.provider} · <span className="font-mono text-xs">{app.id}</span> · draft v{app.version} · created by {app.createdBy} · {app.createdAt}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
          <KV k="Principal" v={<Money value={app.quote.principalMinor} />} />
          <KV k="Net cash" v={<Money value={app.quote.netCashReceivedMinor} />} />
          <KV k="Fee" v={<Money value={app.quote.feeMinor} />} />
          <KV k="Interest" v={<Money value={app.quote.interestMinor} />} />
          <KV k="Repay" v={<Money value={app.quote.maturityRepaymentMinor} />} />
          <KV k="Dates" v={`${app.disbursementDate} → ${app.maturityDate}`} />
        </div>
        {editable ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor={`p-${app.id}`}>Purpose</Label>
              <Input id={`p-${app.id}`} value={purpose} maxLength={200} onChange={(e) => setPurpose(e.target.value)} />
            </div>
            <Button variant="outline" disabled={busy || purpose === app.purpose} onClick={() => run('Edit draft', (c) => c.updateDraftPurpose(app.id, purpose), { success: 'Draft updated; a new review is required.' })}>
              Save edit
            </Button>
          </div>
        ) : (
          <p className="text-sm">Purpose: {app.purpose}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {app.status === 'AWAITING_CONFIRMATION' && action?.status === 'pending' ? (
            <Button onClick={() => onReview(action)}>Review and confirm</Button>
          ) : null}
          {app.status === 'DRAFT' || app.status === 'EXPIRED' ? (
            <Button onClick={prepare} disabled={busy}>
              Prepare sandbox submission
            </Button>
          ) : null}
          {app.status === 'AWAITING_CONFIRMATION' && action?.status === 'pending' ? (
            <Button variant="outline" onClick={() => run('Cancel', (c) => c.cancel(action.id), { success: 'Pending submission cancelled.' })} disabled={busy}>
              Cancel
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
    <div className="rounded-md bg-stone-50 p-2">
      <div className="text-xs text-stone-500">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}
