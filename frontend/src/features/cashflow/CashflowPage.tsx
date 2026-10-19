import { useMemo, useState } from 'react';
import { CartesianGrid, ComposedChart, Area, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarX2, FlaskConical, RotateCcw, TrendingDown, Waves, Wallet } from 'lucide-react';
import {
  BASELINE_SCENARIO,
  SCENARIO_LIMITS,
  STRESS_PRESETS,
  TRUTH_LABELS,
  formatCivilDate,
  projectScenario,
  toBig,
  toChartNumber,
  type Scenario,
} from '@farmlink/engine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Money, PageHeader, Stat, TruthNote } from '@/components/common';
import { useSandbox } from '@/state/SandboxProvider';
import { useMoney } from '@/lib/money';
import { useMarkVisited } from '@/lib/journey';
import { RequireWorkspace } from '@/app/RequireWorkspace';
import { cn } from '@/lib/utils';

export function CashflowPage() {
  return (
    <RequireWorkspace>
      <CashflowInner />
    </RequireWorkspace>
  );
}

function compactAxis(v: number) {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(Math.round(v));
}

function Slider({ id, label, value, min, max, unit, onChange, describe }: { id: string; label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void; describe: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className="tabular text-sm font-semibold text-brand-800">
          {value > 0 && unit === '%' ? '+' : ''}
          {value}
          {unit}
        </span>
      </div>
      <input id={id} type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full" aria-describedby={`${id}-d`} />
      <p id={`${id}-d`} className="mt-1 text-xs text-stone-500">
        {describe}
      </p>
    </div>
  );
}

function CashflowInner() {
  const { snapshot, cashflow, derivedError, run, busy } = useSandbox();
  const { fmt, currency } = useMoney();
  const [scenario, setScenario] = useState<Scenario>({ ...BASELINE_SCENARIO, id: 'custom', label: 'Custom what-if' });
  const [showAll, setShowAll] = useState(false);
  useMarkVisited('/cashflow', !!cashflow);
  const ws = snapshot!.workspace!;
  const active = scenario.salesDelayDays !== 0 || scenario.salesChangePct !== 0 || scenario.costChangePct !== 0;
  const stressed = useMemo(() => (active ? projectScenario(ws, snapshot!.events, scenario) : null), [active, ws, snapshot, scenario]);

  const data = useMemo(
    () =>
      cashflow?.days.map((d, i) => {
        const base = toChartNumber(d.closingMinor);
        return {
          date: d.date,
          closing: base,
          negative: Math.min(0, base),
          whatIf: stressed ? toChartNumber(stressed.days[i]!.closingMinor) : undefined,
        };
      }) ?? [],
    [cashflow, stressed],
  );
  if (derivedError) return <Alert variant="danger">{derivedError}</Alert>;
  if (!cashflow) return null;
  const buffer = toChartNumber(cashflow.bufferMinor);
  const rows = showAll ? cashflow.days : cashflow.days.filter((d) => d.alert !== 'none' || d.eventIds.length);
  const gapDelta = stressed ? toBig(stressed.fundingGapMinor) - toBig(cashflow.fundingGapMinor) : 0n;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 3 · Forecast"
        title="Cash-flow forecast"
        description="A day-by-day projection of closing cash from your records. Closing = opening + inflows − outflows. Funding gap = the deepest point below zero."
        actions={
          <Button variant="outline" onClick={() => run('Analyze cash flow', (c) => c.analyzeCashflow('user'), { success: 'Analysis recorded in Activity.' })} disabled={busy}>
            Record this analysis
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="First negative day" icon={CalendarX2} tone={cashflow.earliestNegativeDate ? 'danger' : 'ok'}>
          {cashflow.earliestNegativeDate ? formatCivilDate(cashflow.earliestNegativeDate) : 'None'}
        </Stat>
        <Stat label="Funding gap" icon={Waves} tone={cashflow.fundingGapMinor !== '0' ? 'danger' : 'ok'}>
          <Money value={cashflow.fundingGapMinor} approx="below" decimals={false} />
        </Stat>
        <Stat label="Below buffer from" icon={TrendingDown} tone={cashflow.earliestBelowBufferDate ? 'warning' : 'ok'} hint={`Buffer ${fmt(cashflow.bufferMinor, { decimals: false })}`}>
          {cashflow.earliestBelowBufferDate ? formatCivilDate(cashflow.earliestBelowBufferDate) : 'Never'}
        </Stat>
        <Stat label="Net cash over window" icon={Wallet} hint={`In ${fmt(cashflow.totals.inflowMinor, { decimals: false })} · Out ${fmt(cashflow.totals.outflowMinor, { decimals: false })}`}>
          <Money value={cashflow.totals.netMinor} decimals={false} />
        </Stat>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Projected closing cash ({currency})</CardTitle>
            <CardDescription>Green line: your records. Dashed amber: minimum buffer. {active ? 'Purple dashed: your what-if scenario.' : 'Try the what-if panel to stress the plan.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full" role="img" aria-label={`Projected closing cash; minimum ${fmt(cashflow.minClosingMinor)} on ${cashflow.minClosingDate}. The table below contains the same values.`}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="negFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.05} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#78716c' }} tickFormatter={(d: string) => formatCivilDate(d).replace(/ \d{4}$/, '')} minTickGap={28} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#78716c' }} width={52} tickFormatter={compactAxis} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }}
                    formatter={(v, name) => [`${currency} ${Number(v).toLocaleString('en-US')}`, name === 'whatIf' ? 'What-if' : 'Closing cash']}
                    labelFormatter={(l) => formatCivilDate(String(l))}
                  />
                  {active ? <Legend formatter={(v) => (v === 'whatIf' ? 'What-if' : v === 'closing' ? 'Records' : '')} wrapperStyle={{ fontSize: 12 }} /> : null}
                  <ReferenceLine y={0} stroke="#a8a29e" />
                  <ReferenceLine y={buffer} stroke="#e8960c" strokeDasharray="5 4" />
                  <Area type="stepAfter" dataKey="negative" fill="url(#negFill)" stroke="none" isAnimationActive={false} tooltipType="none" legendType="none" />
                  <Line type="stepAfter" dataKey="closing" stroke="#187a4f" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                  {active ? <Line type="stepAfter" dataKey="whatIf" stroke="#7c3aed" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} /> : null}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(active && 'ring-2 ring-violet-200')}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="size-4 text-violet-600" aria-hidden /> What-if scenario
            </CardTitle>
            <CardDescription>Stress planned receipts and costs. Your records are not changed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-1.5">
              {STRESS_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:border-violet-300 hover:bg-violet-50"
                  onClick={() => setScenario({ ...p })}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Slider
              id="delay"
              label="Sales arrive later"
              unit=" days"
              value={scenario.salesDelayDays}
              min={SCENARIO_LIMITS.salesDelayDays.min}
              max={60}
              onChange={(v) => setScenario((s) => ({ ...s, salesDelayDays: v }))}
              describe="Shifts planned sales receipts (harvest, buyer payments)."
            />
            <Slider
              id="sales"
              label="Sales amount change"
              unit="%"
              value={scenario.salesChangePct}
              min={-50}
              max={SCENARIO_LIMITS.salesChangePct.max}
              onChange={(v) => setScenario((s) => ({ ...s, salesChangePct: v }))}
              describe="Price or volume change on planned sales."
            />
            <Slider
              id="costs"
              label="Cost change"
              unit="%"
              value={scenario.costChangePct}
              min={-30}
              max={50}
              onChange={(v) => setScenario((s) => ({ ...s, costChangePct: v }))}
              describe="Inputs, transport, and operating costs."
            />
            {stressed ? (
              <div className="space-y-2 rounded-xl bg-violet-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-600">What-if gap</span>
                  <Money value={stressed.fundingGapMinor} decimals={false} className="font-semibold" />
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">Change vs records</span>
                  <span className={cn('tabular font-semibold', gapDelta > 0n ? 'text-red-700' : 'text-emerald-700')}>
                    {gapDelta > 0n ? '+' : ''}
                    {fmt(gapDelta.toString(), { decimals: false })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">First negative day</span>
                  <span className="font-medium">{stressed.earliestNegativeDate ? formatCivilDate(stressed.earliestNegativeDate) : 'None'}</span>
                </div>
                <Button size="sm" variant="ghost" className="w-full" onClick={() => setScenario({ ...BASELINE_SCENARIO, id: 'custom', label: 'Custom what-if' })}>
                  <RotateCcw aria-hidden /> Reset scenario
                </Button>
              </div>
            ) : (
              <p className="text-xs text-stone-500">Move a slider or pick a preset to compare against your records.</p>
            )}
            <TruthNote>Scenarios are your assumptions, not predictions. Settled history is never changed.</TruthNote>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assumptions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm text-stone-700">
              {cashflow.assumptions.map((a) => (
                <li key={a} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                  {a}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Records used</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <dl className="grid grid-cols-2 gap-2">
              {[
                ['Included in window', cashflow.counts.included],
                ['Cancelled (excluded)', cashflow.counts.cancelled],
                ['Settled before window', cashflow.counts.settledBeforeWindow],
                ['Overdue planned', cashflow.counts.overdue],
                ['After window', cashflow.counts.afterWindow],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-stone-50 px-3 py-2">
                  <dt className="text-xs text-stone-500">{k}</dt>
                  <dd className="text-base font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            {cashflow.warnings.map((w) => (
              <TruthNote key={w} tone="warning">
                {w}
              </TruthNote>
            ))}
            <p className="text-xs text-stone-400">
              Engine {cashflow.engineVersion} · workspace v{cashflow.workspaceVersion}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Daily table</CardTitle>
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all {cashflow.days.length} days
          </label>
        </CardHeader>
        <Table>
          <caption className="sr-only">Daily cash-flow projection</caption>
          <THead>
            <tr>
              <TH>Date</TH>
              <TH className="text-right">Opening</TH>
              <TH className="text-right">In (planned / settled)</TH>
              <TH className="text-right">Out (planned / settled)</TH>
              <TH className="text-right">Closing</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((d) => (
              <TR key={d.date} className={cn(d.alert === 'critical' && 'bg-red-50/50', d.alert === 'low' && 'bg-amber-50/50')}>
                <TD className="whitespace-nowrap tabular">{formatCivilDate(d.date)}</TD>
                <TD className="text-right">
                  <Money value={d.openingMinor} decimals={false} />
                </TD>
                <TD className="text-right tabular text-xs text-stone-600">
                  {fmt(d.inflowPlannedMinor, { decimals: false, symbol: false })} / {fmt(d.inflowSettledMinor, { decimals: false, symbol: false })}
                </TD>
                <TD className="text-right tabular text-xs text-stone-600">
                  {fmt(d.outflowPlannedMinor, { decimals: false, symbol: false })} / {fmt(d.outflowSettledMinor, { decimals: false, symbol: false })}
                </TD>
                <TD className="text-right font-medium">
                  <Money value={d.closingMinor} decimals={false} />
                </TD>
                <TD className="text-xs">{d.alert === 'critical' ? <span className="font-medium text-red-700">Negative</span> : d.alert === 'low' ? <span className="text-amber-800">Below buffer</span> : ''}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      <TruthNote>{TRUTH_LABELS.cashflow} Cash balance is not profit.</TruthNote>
    </div>
  );
}
