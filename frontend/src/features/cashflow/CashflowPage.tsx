import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatBDT, formatCivilDate, toChartNumber, TRUTH_LABELS } from '@farmlink/engine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Money, PageHeader, Stat, TruthNote } from '@/components/common';
import { useSandbox } from '@/state/SandboxProvider';
import { RequireWorkspace } from '@/app/RequireWorkspace';
import { cn } from '@/lib/utils';

export function CashflowPage() {
  return (
    <RequireWorkspace>
      <CashflowInner />
    </RequireWorkspace>
  );
}

function CashflowInner() {
  const { cashflow, derivedError, run, busy } = useSandbox();
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const data = useMemo(
    () =>
      cashflow?.days.map((d) => ({
        date: d.date,
        closing: toChartNumber(d.closingMinor),
        negative: Math.min(0, toChartNumber(d.closingMinor)),
      })) ?? [],
    [cashflow],
  );
  if (derivedError) return <Alert variant="danger">{derivedError}</Alert>;
  if (!cashflow) return null;
  const buffer = toChartNumber(cashflow.bufferMinor);
  const rows = onlyAlerts ? cashflow.days.filter((d) => d.alert !== 'none' || d.eventIds.length) : cashflow.days;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash-flow forecast"
        description={`Daily projection ${cashflow.window.start} to ${cashflow.window.end}. closing = opening + inflows − outflows; funding gap = max(0, −minimum closing).`}
        actions={
          <Button onClick={() => run('Analyze cash flow', (c) => c.analyzeCashflow('user'), { success: 'Cash-flow analysis logged to activity.' })} disabled={busy}>
            Run and log analysis
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="First negative day" tone={cashflow.earliestNegativeDate ? 'danger' : 'ok'}>
          {cashflow.earliestNegativeDate ? formatCivilDate(cashflow.earliestNegativeDate) : 'None'}
        </Stat>
        <Stat label="Funding gap" tone={cashflow.fundingGapMinor !== '0' ? 'danger' : 'ok'} hint="Largest cumulative shortfall">
          <Money value={cashflow.fundingGapMinor} />
        </Stat>
        <Stat label="Below buffer from" tone={cashflow.earliestBelowBufferDate ? 'warning' : 'ok'} hint={`Buffer ${formatBDT(cashflow.bufferMinor)}`}>
          {cashflow.earliestBelowBufferDate ? formatCivilDate(cashflow.earliestBelowBufferDate) : 'Never'}
        </Stat>
        <Stat label="Window net cash" hint={`In ${formatBDT(cashflow.totals.inflowMinor)} · Out ${formatBDT(cashflow.totals.outflowMinor)}`}>
          <Money value={cashflow.totals.netMinor} />
        </Stat>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Projected closing cash</CardTitle>
          <CardDescription>Dashed line: minimum buffer. Red area: negative cash. The table below contains the same values.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full" role="img" aria-label={`Line chart of projected closing cash; minimum ${formatBDT(cashflow.minClosingMinor)} on ${cashflow.minClosingDate}.`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} width={64} tickFormatter={(v: number) => (Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${Math.round(v / 1000)}k`)} />
                <Tooltip formatter={(v) => [`BDT ${Number(v).toLocaleString('en-IN')}`, 'Closing cash']} labelFormatter={(l) => String(l)} />
                <ReferenceLine y={0} stroke="#78716c" />
                <ReferenceLine y={buffer} stroke="#b45309" strokeDasharray="5 4" />
                <Area type="stepAfter" dataKey="negative" fill="#fecaca" stroke="none" isAnimationActive={false} tooltipType="none" />
                <Line type="stepAfter" dataKey="closing" stroke="#166534" strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-stone-600">Y-axis: L = lakh (100,000 BDT), k = thousand BDT.</p>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assumptions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
              {cashflow.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Inputs used</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Included events: {cashflow.counts.included}</p>
            <p>Cancelled (excluded): {cashflow.counts.cancelled}</p>
            <p>Settled before window (already in opening cash): {cashflow.counts.settledBeforeWindow}</p>
            <p>Overdue planned (excluded until rescheduled): {cashflow.counts.overdue}</p>
            <p>After window: {cashflow.counts.afterWindow}</p>
            <p className="text-xs text-stone-500">
              Engine {cashflow.engineVersion} · workspace v{cashflow.workspaceVersion}
            </p>
            {cashflow.warnings.map((w) => (
              <TruthNote key={w} tone="warning">
                {w}
              </TruthNote>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Daily table</CardTitle>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyAlerts} onChange={(e) => setOnlyAlerts(e.target.checked)} /> Only days with movements or alerts
          </label>
        </CardHeader>
        <Table>
          <caption className="sr-only">Daily cash-flow projection</caption>
          <THead>
            <tr>
              <TH>Date</TH>
              <TH className="text-right">Opening</TH>
              <TH className="text-right">Inflow (planned / settled)</TH>
              <TH className="text-right">Outflow (planned / settled)</TH>
              <TH className="text-right">Closing</TH>
              <TH>Alert</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((d) => (
              <TR key={d.date} className={cn(d.alert === 'critical' && 'bg-red-50/60', d.alert === 'low' && 'bg-amber-50/60')}>
                <TD className="whitespace-nowrap tabular">{d.date}</TD>
                <TD className="text-right">
                  <Money value={d.openingMinor} />
                </TD>
                <TD className="text-right tabular text-xs">
                  {formatBDT(d.inflowPlannedMinor, { withSymbol: false })} / {formatBDT(d.inflowSettledMinor, { withSymbol: false })}
                </TD>
                <TD className="text-right tabular text-xs">
                  {formatBDT(d.outflowPlannedMinor, { withSymbol: false })} / {formatBDT(d.outflowSettledMinor, { withSymbol: false })}
                </TD>
                <TD className="text-right font-medium">
                  <Money value={d.closingMinor} />
                </TD>
                <TD>{d.alert === 'critical' ? 'Negative cash' : d.alert === 'low' ? 'Below buffer' : ''}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      <TruthNote>{TRUTH_LABELS.cashflow} Cash balance is not profit.</TruthNote>
    </div>
  );
}
