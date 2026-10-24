import React from 'react';
import { interpolate } from 'remotion';
import { CalendarX, Check, Hourglass, Landmark, TrendingDown, TrendingUp, X, Zap } from 'lucide-react';
import { C } from './theme';
import cash from './cashflow.json';
import { Card, Chrome, IconBadge, Kicker, LightBg, SceneShell, pop, ramp } from './kit';
import { vf } from './timing';
import { at } from './scenesA';

type SceneProps = { start: number; end: number };

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/* ------------------------------------------------------------------ 4 Forecast */
const CW = 1060;
const CH = 470;
export const Forecast: React.FC<SceneProps> = ({ start, end }) => (
  <SceneShell start={start} end={end}>
    {(g) => {
      const vals = cash.days.map((d) => d.closing);
      const max = Math.max(...vals) * 1.1;
      const min = Math.min(...vals) * 1.15;
      const x = (i: number) => (i / (vals.length - 1)) * CW;
      const y = (v: number) => ((max - v) / (max - min)) * CH;
      const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
      const area = `${line} L${CW} ${y(0)} L0 ${y(0)} Z`;
      const draw = ramp(g, at(3, 1) - 0.3, 3.2);
      const firstNeg = cash.days.findIndex((d) => d.date === cash.earliestNegativeDate);
      const minIdx = cash.days.findIndex((d) => d.date === cash.minDate);
      const negT = pop(g, at(3, 3));
      const gapT = pop(g, at(3, 4));
      const days = Math.round(interpolate(ramp(g, at(3, 3), 1), [0, 1], [0, 7]));
      const gapVal = 425000 * ramp(g, at(3, 4), 1.4);
      const months = [
        { i: 0, l: '20 Oct' },
        { i: 12, l: '1 Nov' },
        { i: 42, l: '1 Dec' },
        { i: 73, l: '1 Jan' },
        { i: 89, l: '17 Jan' },
      ];
      return (
        <>
          <LightBg />
          <Chrome dark={false} />
          <div style={{ position: 'absolute', left: 120, top: 128 }}>
            <Kicker>Demo cooperative · fictional sandbox data</Kicker>
            <div style={{ marginTop: 18, fontSize: 62, fontWeight: 700, letterSpacing: -1.2, opacity: pop(g, at(3, 0)) }}>Cash, projected day by day</div>
          </div>
          <Card style={{ position: 'absolute', left: 120, top: 330, width: 1180, height: 600, padding: '40px 60px 40px 60px', opacity: pop(g, at(3, 0)) }}>
            <svg width={CW} height={CH + 50} style={{ overflow: 'visible' }}>
              <defs>
                <clipPath id="reveal">
                  <rect x={0} y={-40} width={CW * draw} height={CH + 120} />
                </clipPath>
                <clipPath id="below">
                  <rect x={0} y={y(0)} width={CW} height={CH} />
                </clipPath>
                <clipPath id="above">
                  <rect x={0} y={0} width={CW} height={y(0)} />
                </clipPath>
              </defs>
              <line x1={0} x2={CW} y1={y(0)} y2={y(0)} stroke="#9AA59F" strokeWidth={2} strokeDasharray="8 8" />
              <text x={CW + 12} y={y(0) + 8} fontSize={22} fill={C.muted}>0</text>
              <g clipPath="url(#reveal)">
                <path d={area} fill="rgba(37,152,99,0.14)" clipPath="url(#above)" />
                <path d={area} fill="rgba(180,35,24,0.18)" clipPath="url(#below)" />
                <path d={line} fill="none" stroke={C.green} strokeWidth={5} strokeLinejoin="round" />
              </g>
              {months.map((m) => (
                <text key={m.l} x={x(m.i)} y={CH + 44} fontSize={22} fill={C.muted} textAnchor="middle">{m.l}</text>
              ))}
              {/* first negative day */}
              <g opacity={negT} transform={`translate(${x(firstNeg)} ${y(vals[firstNeg])})`}>
                <circle r={12 + 4 * Math.sin(g / 5)} fill="rgba(180,35,24,0.25)" />
                <circle r={9} fill={C.red} />
                <rect x={14} y={-66} width={250} height={48} rx={12} fill={C.red} />
                <text x={30} y={-34} fontSize={24} fontWeight={700} fill="#fff">27 Oct · runs out</text>
              </g>
              {/* gap bracket */}
              <g opacity={gapT}>
                <line x1={x(minIdx)} x2={x(minIdx)} y1={y(0)} y2={y(0) + (y(vals[minIdx]) - y(0)) * gapT} stroke={C.red} strokeWidth={4} />
                <circle cx={x(minIdx)} cy={y(vals[minIdx])} r={9} fill={C.red} />
                <rect x={x(minIdx) - 300} y={y(vals[minIdx]) - 24} width={270} height={48} rx={12} fill="#fff" stroke={C.red} strokeWidth={2} />
                <text x={x(minIdx) - 165} y={y(vals[minIdx]) + 9} fontSize={24} fontWeight={700} fill={C.red} textAnchor="middle">Lowest · 9 Dec</text>
              </g>
            </svg>
          </Card>
          <div style={{ position: 'absolute', left: 1350, top: 330, width: 450, display: 'flex', flexDirection: 'column', gap: 26 }}>
            <Card accent={C.red} style={{ padding: '26px 32px', opacity: negT, transform: `translateX(${(1 - negT) * 60}px)` }}>
              <div style={{ fontSize: 26, fontWeight: 600, color: C.muted }}>Cash runs out in</div>
              <div style={{ fontSize: 84, fontWeight: 700, color: C.red, lineHeight: 1.05 }}>{days} days</div>
            </Card>
            <Card accent={C.amber} style={{ padding: '26px 32px', opacity: pop(g, at(3, 3) + 0.8), transform: `translateX(${(1 - pop(g, at(3, 3) + 0.8)) * 60}px)` }}>
              <div style={{ fontSize: 26, fontWeight: 600, color: C.muted }}>First negative day</div>
              <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>27 October</div>
            </Card>
            <Card accent={C.red} style={{ padding: '26px 32px', background: '#FDF0EE', opacity: gapT, transform: `translateX(${(1 - gapT) * 60}px)` }}>
              <div style={{ fontSize: 26, fontWeight: 600, color: C.red }}>Funding gap</div>
              <div style={{ fontSize: 64, fontWeight: 700, color: C.red, lineHeight: 1.1 }}>BDT {fmt(gapVal)}</div>
            </Card>
          </div>
        </>
      );
    }}
  </SceneShell>
);

/* ------------------------------------------------------------------ 5 Compare */
const OPTIONS = [
  { k: 'A', short: 'Seasonal', name: 'Seasonal Crop Line', s: 'fits', note: 'Lowest cost · BDT 14,513' },
  { k: 'B', short: 'Agri', name: 'Agri Working Capital', s: 'fits', note: 'Cost BDT 15,089' },
  { k: 'C', short: 'Supplier', name: 'Input Supplier Credit', s: 'no', note: 'Money arrives too late' },
  { k: 'D', short: 'Bridge', name: 'Short Bridge Loan', s: 'no', note: 'Due before harvest' },
  { k: 'E', short: 'Harvest', name: 'Harvest Loan', s: 'info', note: 'Matures after forecast' },
  { k: 'F', short: 'Template', name: 'Template product', s: 'info', note: 'Fee unknown, not zero' },
  { k: 'G', short: 'Group', name: 'Cooperative Group Loan', s: 'no', note: 'Above funding cap' },
  { k: 'H', short: 'Monthly', name: 'Monthly Installment', s: 'no', note: 'Structure not supported' },
] as const;
const STATUS = {
  fits: { label: 'Fits', fg: C.green, bg: '#E3F1E8' },
  no: { label: 'Does not fit', fg: C.red, bg: C.redTint },
  info: { label: 'Needs info', fg: '#8A5A00', bg: C.amberTint },
};

export const Compare: React.FC<SceneProps> = ({ start, end }) => (
  <SceneShell start={start} end={end}>
    {(g) => {
      const q1 = pop(g, at(4, 2));
      const q2 = pop(g, at(4, 3));
      return (
        <>
          <LightBg />
          <Chrome dark={false} />
          <div style={{ position: 'absolute', left: 120, top: 128 }}>
            <Kicker>Financing comparison</Kicker>
            <div style={{ marginTop: 18, fontSize: 62, fontWeight: 700, letterSpacing: -1.2, opacity: pop(g, at(4, 0)) }}>8 options, checked against the exact gap</div>
          </div>
          <div style={{ position: 'absolute', left: 120, top: 330, display: 'flex', gap: 20 }}>
            {[
              { p: q1, icon: <Hourglass size={30} color={C.blue} />, text: 'Arrives before 27 Oct?' },
              { p: q2, icon: <Landmark size={30} color={C.blue} />, text: "Repayable from this season's cash?" },
            ].map((q) => (
              <div key={q.text} style={{ opacity: q.p, transform: `translateY(${(1 - q.p) * 20}px)`, display: 'flex', alignItems: 'center', gap: 12, background: C.blueTint, color: C.blue, fontSize: 30, fontWeight: 700, padding: '12px 26px', borderRadius: 999 }}>
                {q.icon} {q.text}
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', left: 120, top: 430, width: 1680, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {OPTIONS.map((o, i) => {
              const appear = pop(g, at(4, 0) + 0.3 + i * 0.12);
              const flipAt = o.s === 'fits' ? at(4, 4) + (i === 0 ? 0 : 0.25) : at(4, 5) + 0.15 * i - 0.3;
              const fp = ramp(g, flipAt, 0.5);
              const front = fp >= 0.5;
              const sx = front ? (fp - 0.5) * 2 : 1 - fp * 2;
              const st = STATUS[o.s];
              return (
                <div key={o.k} style={{ height: 196, opacity: appear, transform: `translateY(${(1 - appear) * 40}px) scaleX(${Math.max(0.02, sx)})` }}>
                  {front ? (
                    <Card accent={st.fg} style={{ height: '100%', padding: '22px 26px', boxSizing: 'border-box', background: o.s === 'fits' ? '#F4FBF6' : C.white }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 30, fontWeight: 700 }}>{o.k} · {o.short}</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: st.fg, background: st.bg, padding: '6px 14px', borderRadius: 999, whiteSpace: 'nowrap' }}>{st.label}</div>
                      </div>
                      <div style={{ marginTop: 10, fontSize: 24, color: C.muted }}>{o.name}</div>
                      <div style={{ marginTop: 16, fontSize: 27, fontWeight: 600, color: st.fg }}>{o.note}</div>
                    </Card>
                  ) : (
                    <Card style={{ height: '100%', padding: '22px 26px', boxSizing: 'border-box', background: '#EEF1EE', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: 56, fontWeight: 700, color: '#B8C2BC' }}>{o.k}</div>
                      <div style={{ fontSize: 24, color: '#8A948F' }}>{o.name}</div>
                    </Card>
                  )}
                </div>
              );
            })}
          </div>
        </>
      );
    }}
  </SceneShell>
);

/* ------------------------------------------------------------------ 6 Stress test */
const SCEN = [
  { label: 'Harvest 14 days late', icon: CalendarX, buffer: true },
  { label: 'Sales −20%', icon: TrendingDown, buffer: true },
  { label: 'Costs +15%', icon: TrendingUp, buffer: false },
  { label: 'Combined shock', icon: Zap, buffer: false },
];
export const Stress: React.FC<SceneProps> = ({ start, end }) => (
  <SceneShell start={start} end={end}>
    {(g) => {
      const phase2 = ramp(g, at(5, 4), 0.6);
      const failT = at(5, 3);
      const passTimes = [at(5, 6), at(5, 6) + 0.9];
      const results = SCEN.map((s, i) => {
        if (phase2 < 0.5) return { state: g >= vf(failT + i * 0.15) ? 'fail' : 'idle', t: failT + i * 0.15 };
        if (s.buffer) return { state: g >= vf(passTimes[i]) ? 'pass' : 'idle', t: passTimes[i] };
        return { state: g >= vf(at(5, 5)) ? 'fail' : 'idle', t: at(5, 5) };
      });
      const passed = results.filter((r) => r.state === 'pass').length;
      const scoreShown = phase2 < 0.5 ? pop(g, failT + 0.7) : pop(g, passTimes[1] + 0.3);
      return (
        <>
          <LightBg />
          <Chrome dark={false} />
          <div style={{ position: 'absolute', left: 120, top: 128 }}>
            <Kicker>Repayment stress test</Kicker>
            <div style={{ marginTop: 18, fontSize: 62, fontWeight: 700, letterSpacing: -1.2, opacity: pop(g, at(5, 0)) }}>
              Cheapest is not always <span style={{ color: C.green }}>safest</span>
            </div>
          </div>
          {/* mode toggle */}
          <div style={{ position: 'absolute', left: 120, top: 330, display: 'flex', background: '#E8ECE9', borderRadius: 999, padding: 8, opacity: pop(g, at(5, 1)) }}>
            {['Borrow the gap only', 'Gap + small buffer'].map((m, i) => {
              const on = i === 0 ? 1 - phase2 : phase2;
              return (
                <div key={m} style={{ fontSize: 30, fontWeight: 700, padding: '14px 32px', borderRadius: 999, background: `rgba(${i ? '245,181,46' : '20,98,65'},${on})`, color: on > 0.5 ? (i ? C.deep : '#fff') : C.muted }}>
                  {m}
                </div>
              );
            })}
          </div>
          <Card style={{ position: 'absolute', left: 120, top: 440, width: 1080, padding: '18px 40px' }}>
            {SCEN.map((s, i) => {
              const p = pop(g, at(5, 1) + i * 0.7);
              const r = results[i];
              const rp = pop(g, r.t, 11);
              const Icon = s.icon;
              return (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '18px 0', borderBottom: i < 3 ? `1px solid ${C.line}` : 'none', opacity: p }}>
                  <IconBadge bg={C.blueTint} size={64}>
                    <Icon size={34} color={C.blue} />
                  </IconBadge>
                  <div style={{ flex: 1, fontSize: 36, fontWeight: 600 }}>{s.label}</div>
                  {r.state === 'idle' ? (
                    <div style={{ width: 64, height: 64, borderRadius: 32, border: `3px dashed ${C.line}` }} />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 32, background: r.state === 'pass' ? C.green : C.red, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${rp})` }}>
                      {r.state === 'pass' ? <Check size={38} color="#fff" strokeWidth={3} /> : <X size={38} color="#fff" strokeWidth={3} />}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
          <Card accent={phase2 < 0.5 ? C.red : C.green} style={{ position: 'absolute', left: 1260, top: 440, width: 540, padding: '34px 40px', opacity: scoreShown, transform: `scale(${0.9 + 0.1 * scoreShown})` }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: C.muted }}>Option A · lowest cost</div>
            <div style={{ fontSize: 120, fontWeight: 700, lineHeight: 1.05, color: phase2 < 0.5 ? C.red : C.green }}>
              {phase2 < 0.5 ? 0 : passed} / 4
            </div>
            <div style={{ fontSize: 30, fontWeight: 600 }}>{phase2 < 0.5 ? 'scenarios survived: fragile' : 'survived with a buffer'}</div>
            <div style={{ marginTop: 18, fontSize: 24, color: C.muted }}>Loan held fixed · scenarios are assumptions, not predictions</div>
          </Card>
        </>
      );
    }}
  </SceneShell>
);

