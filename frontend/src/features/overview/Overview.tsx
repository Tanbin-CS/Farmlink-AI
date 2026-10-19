import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, CheckCircle2, TrendingDown, Wallet, Waves } from 'lucide-react';
import { DEMO_DISCLAIMER, TRUTH_LABELS, diffDays, formatCivilDate, toChartNumber } from '@farmlink/engine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState, Money, PageHeader, Stat, StatusBadge, TruthNote } from '@/components/common';
import { useSandbox } from '@/state/SandboxProvider';
import { useMoney } from '@/lib/money';
import { useJourney } from '@/lib/journey';
import { RequireWorkspace } from '@/app/RequireWorkspace';
import { cn } from '@/lib/utils';

export function Overview() {
  return (
    <RequireWorkspace>
      <OverviewInner />
    </RequireWorkspace>
  );
}

function OverviewInner() {
  const { snapshot, cashflow, comparison, derivedError } = useSandbox();
  const { fmt, approx } = useMoney();
  const { next, completed, total } = useJourney();
  const ws = snapshot!.workspace!;
  const best = comparison?.evaluations.find((e) => e.productId === comparison.bestFitProductId);
  const latestApp = snapshot!.applications[0];

  const upcoming = useMemo(
    () =>
      [...snapshot!.events]
        .filter((e) => e.status === 'planned' && e.date >= ws.asOfDate)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6),
    [snapshot, ws.asOfDate],
  );

  if (derivedError) return <p className="text-red-700">{derivedError}</p>;
  if (!snapshot!.events.length || !cashflow) {
    return (
      <>
        <PageHeader eyebrow="Overview" title={ws.businessName} />
        <EmptyState
          title="Add your first cash records"
          icon={Wallet}
          action={
            <Link to="/records" className={buttonVariants()}>
              Add or import records
            </Link>
          }
        >
          The forecast needs dated sales and costs. Nothing is pre-filled with invented balances.
        </EmptyState>
      </>
    );
  }

  const shortfall = cashflow.earliestNegativeDate;
  const daysToShortfall = shortfall ? diffDays(ws.asOfDate, shortfall) : null;
  const belowBuffer = !shortfall && cashflow.earliestBelowBufferDate;
  const tone = shortfall ? 'danger' : belowBuffer ? 'warning' : 'ok';
  const chartData = cashflow.days.map((d) => ({ date: d.date, closing: toChartNumber(d.closingMinor) }));
  const recovery = shortfall ? cashflow.days.find((d) => d.date > cashflow.minClosingDate && !d.closingMinor.startsWith('-'))?.date : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title={ws.businessName}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{ws.businessType === 'cooperative' ? 'Agricultural cooperative' : 'Small agribusiness'}</span>
            <span aria-hidden>·</span>
            <span>
              {formatCivilDate(cashflow.window.start)} → {formatCivilDate(cashflow.window.end)}
            </span>
            <span aria-hidden>·</span>
            <span>{ws.currency}</span>
            {ws.provenance === 'sandbox_fixture' ? <span className="rounded-full bg-harvest-100 px-2 py-0.5 text-xs font-medium text-amber-900">Fictional demo data</span> : null}
          </span>
        }
      />

      {/* Cash health hero */}
      <section
        className={cn(
          'relative overflow-hidden rounded-3xl p-6 text-white shadow-[var(--shadow-lift)] sm:p-8',
          tone === 'danger' ? 'bg-gradient-to-br from-[#5b1414] via-[#7f1d1d] to-[#9a3412]' : tone === 'warning' ? 'bg-gradient-to-br from-[#713f12] to-[#a16207]' : 'bg-brand-gradient',
        )}
        aria-labelledby="health-title"
      >
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
              {tone === 'ok' ? <CheckCircle2 className="size-3.5" aria-hidden /> : <AlertTriangle className="size-3.5" aria-hidden />}
              {tone === 'danger' ? 'Cash shortfall ahead' : tone === 'warning' ? 'Cash below your buffer' : 'Cash stays healthy'}
            </div>
            <h2 id="health-title" className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
              {shortfall ? (
                <>
                  Cash runs out in {daysToShortfall} day{daysToShortfall === 1 ? '' : 's'}, on {formatCivilDate(shortfall)}.
                </>
              ) : belowBuffer ? (
                <>Cash dips below your buffer on {formatCivilDate(belowBuffer)}.</>
              ) : (
                <>No shortfall in the next {ws.forecastDays} days.</>
              )}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
              {shortfall ? (
                <>
                  You need <strong className="text-white">{fmt(cashflow.fundingGapMinor, { decimals: false })}</strong>
                  {approx(cashflow.fundingGapMinor) ? <span className="text-white/70"> ({approx(cashflow.fundingGapMinor)})</span> : null} to stay above zero. The lowest point is{' '}
                  {formatCivilDate(cashflow.minClosingDate)}
                  {recovery ? <>, and cash recovers on {formatCivilDate(recovery)} when receipts arrive</> : null}.
                </>
              ) : (
                <>
                  Lowest balance {fmt(cashflow.minClosingMinor, { decimals: false })} on {formatCivilDate(cashflow.minClosingDate)}. There is no pressure to borrow.
                </>
              )}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {shortfall ? (
                <Link to="/financing" className={buttonVariants({ variant: 'harvest', size: 'lg' })}>
                  Find financing that covers it <ArrowRight aria-hidden />
                </Link>
              ) : null}
              <Link to="/cashflow" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'border-white/30 bg-white/10 text-white hover:border-white/50 hover:bg-white/20')}>
                See the forecast
              </Link>
            </div>
          </div>
          <div className="h-44 rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 sm:h-52" role="img" aria-label="Projected closing cash over the forecast window">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fff" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#fff" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={['dataMin', 'dataMax']} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.6)" strokeDasharray="4 4" />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }}
                  formatter={(v) => [Number(v).toLocaleString('en-US'), 'Closing cash']}
                  labelFormatter={(l) => String(l)}
                />
                <Area type="stepAfter" dataKey="closing" stroke="#fff" strokeWidth={2} fill="url(#heroFill)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Opening cash" icon={Wallet} hint={`Start of ${formatCivilDate(ws.asOfDate)}`}>
          <Money value={cashflow.openingCashMinor} approx="below" decimals={false} />
        </Stat>
        <Stat label="Lowest point" icon={TrendingDown} tone={cashflow.minClosingMinor.startsWith('-') ? 'danger' : 'ok'} hint={formatCivilDate(cashflow.minClosingDate)}>
          <Money value={cashflow.minClosingMinor} approx="below" decimals={false} />
        </Stat>
        <Stat label="Funding gap" icon={Waves} tone={cashflow.fundingGapMinor !== '0' ? 'danger' : 'ok'} hint="Largest cumulative shortfall">
          <Money value={cashflow.fundingGapMinor} approx="below" decimals={false} />
        </Stat>
        <Stat label="Ending cash" icon={CalendarClock} hint={`End of ${formatCivilDate(cashflow.window.end)}`}>
          <Money value={cashflow.totals.endingCashMinor} approx="below" decimals={false} />
        </Stat>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Upcoming money movements</CardTitle>
            <Link to="/records" className="text-sm font-medium text-brand-700 hover:underline">
              All records
            </Link>
          </CardHeader>
          <CardContent>
            {upcoming.length ? (
              <ul className="divide-y divide-stone-100">
                {upcoming.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', e.direction === 'inflow' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                      {e.direction === 'inflow' ? <ArrowDownRight className="size-4" aria-label="inflow" /> : <ArrowUpRight className="size-4" aria-label="outflow" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{e.description || e.id}</div>
                      <div className="text-xs text-stone-500">
                        {formatCivilDate(e.date)} · {e.category.replace(/_/g, ' ')}
                      </div>
                    </div>
                    <Money value={e.direction === 'outflow' ? `-${e.amountMinor}` : e.amountMinor} signed className="text-sm font-semibold" decimals={false} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-600">No planned movements ahead.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {next ? (
            <Card className="border-brand-200 bg-brand-50/60">
              <CardContent className="pt-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                  Next step · {completed}/{total} done
                </div>
                <div className="mt-1 text-base font-semibold">{next.label}</div>
                <p className="mt-0.5 text-sm text-stone-600">{next.hint}</p>
                <Link to={next.to} className={cn(buttonVariants({ size: 'sm' }), 'mt-3')}>
                  Continue <ArrowRight aria-hidden />
                </Link>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Financing at a glance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {best?.quote ? (
                <div className="rounded-xl bg-stone-50 p-3">
                  <div className="text-xs text-stone-500">Lowest modeled cost among the options provided</div>
                  <div className="mt-0.5 font-semibold">{best.productName}</div>
                  <div className="mt-1 text-stone-600">
                    Borrow <Money value={best.quote.principalMinor} decimals={false} /> · cost <Money value={best.quote.totalFinancingCostMinor} decimals={false} />
                  </div>
                </div>
              ) : comparison ? (
                <p>{comparison.notes[0]}</p>
              ) : null}
              {latestApp ? (
                <p className="flex flex-wrap items-center gap-2">
                  Latest application: <span className="font-medium">{latestApp.productName}</span> <StatusBadge status={latestApp.status} />
                </p>
              ) : null}
              {cashflow.overduePlanned.length ? (
                <p className="flex gap-2 text-amber-900">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {cashflow.overduePlanned.length} overdue planned item(s) are excluded until you reschedule or settle them.
                </p>
              ) : null}
              <TruthNote>{TRUTH_LABELS.financing}</TruthNote>
            </CardContent>
          </Card>
        </div>
      </div>
      {ws.provenance === 'sandbox_fixture' ? <TruthNote>{DEMO_DISCLAIMER}</TruthNote> : null}
      <TruthNote>{TRUTH_LABELS.cashflow}</TruthNote>
    </div>
  );
}
