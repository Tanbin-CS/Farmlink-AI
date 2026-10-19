import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { DEMO_DISCLAIMER, formatBDT, TRUTH_LABELS } from '@farmlink/engine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { EmptyState, Money, PageHeader, Stat, StatusBadge, TruthNote } from '@/components/common';
import { useSandbox } from '@/state/SandboxProvider';
import { RequireWorkspace } from '@/app/RequireWorkspace';

export function Overview() {
  return (
    <RequireWorkspace>
      <OverviewInner />
    </RequireWorkspace>
  );
}

function OverviewInner() {
  const { snapshot, cashflow, comparison, derivedError } = useSandbox();
  const ws = snapshot!.workspace!;
  const best = comparison?.evaluations.find((e) => e.productId === comparison.bestFitProductId);
  const latestApp = snapshot!.applications[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={ws.businessName}
        description={
          <>
            {ws.businessType === 'cooperative' ? 'Agricultural cooperative' : 'Small agribusiness'} · as of {ws.asOfDate} · {ws.forecastDays}-day window · workspace v{ws.version}
          </>
        }
        actions={
          <>
            <Link to="/records" className={buttonVariants({ variant: 'outline' })}>
              Edit records
            </Link>
            <Link to="/cashflow" className={buttonVariants()}>
              Analyze cash flow <ArrowRight aria-hidden />
            </Link>
          </>
        }
      />
      {ws.provenance === 'sandbox_fixture' ? (
        <Alert variant="neutral">
          <div>{DEMO_DISCLAIMER}</div>
        </Alert>
      ) : null}
      {derivedError ? <Alert variant="danger">{derivedError}</Alert> : null}
      {!snapshot!.events.length ? (
        <EmptyState
          title="No cash records yet"
          action={
            <Link to="/records" className={buttonVariants()}>
              Add or import records
            </Link>
          }
        >
          The forecast needs dated inflows and outflows. No balances are invented.
        </EmptyState>
      ) : null}
      {cashflow ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Opening cash" hint={`Start of ${ws.asOfDate}`}>
              <Money value={cashflow.openingCashMinor} />
            </Stat>
            <Stat label="Next shortfall" tone={cashflow.earliestNegativeDate ? 'danger' : 'ok'} hint={cashflow.earliestNegativeDate ? 'First day closing cash is negative' : 'No negative day in window'}>
              {cashflow.earliestNegativeDate ?? 'None'}
            </Stat>
            <Stat label="Funding gap" tone={cashflow.fundingGapMinor !== '0' ? 'danger' : 'ok'} hint={`Minimum ${formatBDT(cashflow.minClosingMinor)} on ${cashflow.minClosingDate}`}>
              <Money value={cashflow.fundingGapMinor} />
            </Stat>
            <Stat label="Ending cash" hint={`End of ${cashflow.window.end}`}>
              <Money value={cashflow.totals.endingCashMinor} />
            </Stat>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Data quality and alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {cashflow.alerts.length ? (
                  <p>
                    <strong>{cashflow.alerts.filter((a) => a.level === 'critical').length}</strong> day(s) with negative cash and{' '}
                    <strong>{cashflow.alerts.filter((a) => a.level === 'low').length}</strong> day(s) below the {formatBDT(ws.minimumCashBufferMinor)} buffer.
                  </p>
                ) : (
                  <p>No low-cash alerts in the window.</p>
                )}
                {cashflow.warnings.map((w) => (
                  <p key={w} className="flex gap-2 text-amber-900">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {w}
                  </p>
                ))}
                {cashflow.overduePlanned.length ? (
                  <div>
                    <h3 className="mt-2 font-medium">Overdue planned items (excluded until rescheduled or settled)</h3>
                    <ul className="mt-1 list-disc pl-5">
                      {cashflow.overduePlanned.map((o) => (
                        <li key={o.id}>
                          {o.date} · {o.description || o.id} · <Money value={o.direction === 'outflow' ? `-${o.amountMinor}` : o.amountMinor} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <TruthNote>{TRUTH_LABELS.cashflow}</TruthNote>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Financing and applications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {comparison ? <p>{comparison.notes[0]}</p> : null}
                {best?.quote ? (
                  <p>
                    {best.productName}: principal <Money value={best.quote.principalMinor} />, modeled cost <Money value={best.quote.totalFinancingCostMinor} />.
                  </p>
                ) : null}
                <Link to="/financing" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Compare financing
                </Link>
                {latestApp ? (
                  <p className="flex flex-wrap items-center gap-2">
                    Latest application: {latestApp.productName} <StatusBadge status={latestApp.status} />
                    <Link className="text-brand-800 underline" to="/applications">
                      Open
                    </Link>
                  </p>
                ) : (
                  <p className="text-stone-600">No applications yet.</p>
                )}
                <TruthNote>{TRUTH_LABELS.financing}</TruthNote>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
