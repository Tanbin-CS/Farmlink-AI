import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Bot, CalendarClock, ChartLine, FileSpreadsheet, FileText, Percent, Scale, UserCheck, Wheat, Coins, Ruler } from 'lucide-react';
import { C, FONT } from './theme';
import { CUES, vf } from './timing';
import { Card, Chrome, DarkBg, IconBadge, Kicker, Leaf, LightBg, SceneShell, lerp, pop, ramp } from './kit';

/** Voice time of the i-th subtitle line in a scene. */
export const at = (scene: number, i: number) => CUES.filter((c) => c.scene === scene)[i].start;

type SceneProps = { start: number; end: number };

/* ------------------------------------------------------------------ Intro */
export const Intro: React.FC<{ end: number }> = ({ end }) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, 22], [0, 1], { extrapolateRight: 'clamp' });
  const out = interpolate(f, [end - 12, end], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sub = interpolate(f, [16, 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity: out, fontFamily: FONT }}>
      <DarkBg />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 26, color: C.paper }}>
        <div style={{ transform: `scale(${0.6 + s * 0.4})`, opacity: s, display: 'flex', alignItems: 'center', gap: 28 }}>
          <div style={{ width: 132, height: 132, borderRadius: 40, background: 'rgba(245,181,46,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Leaf size={86} color={C.amber} />
          </div>
          <div style={{ fontSize: 132, fontWeight: 700, letterSpacing: -3 }}>
            FarmLink <span style={{ color: C.amber }}>AI</span>
          </div>
        </div>
        <div style={{ opacity: sub, fontSize: 40, color: '#CFE3D8', transform: `translateY(${(1 - sub) * 14}px)` }}>Bridge the gap between planting and harvest</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ 1 Hook */
const Hills: React.FC<{ g: number }> = ({ g }) => {
  const sway = Math.sin(g / 22) * 4;
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <pattern id="paddy" width="48" height="18" patternUnits="userSpaceOnUse" patternTransform="skewX(-20)">
          <path d="M0 9 H48" stroke="rgba(245,181,46,0.18)" strokeWidth="2" />
        </pattern>
      </defs>
      <path d="M0 770 C 320 700, 620 740, 960 720 S 1600 690, 1920 730 V1080 H0 Z" fill="#1D6B47" />
      <path d="M0 770 C 320 700, 620 740, 960 720 S 1600 690, 1920 730 V1080 H0 Z" fill="url(#paddy)" />
      <path d="M0 860 C 400 800, 800 850, 1200 820 S 1700 800, 1920 830 V1080 H0 Z" fill="#14563A" />
      <path d="M0 860 C 400 800, 800 850, 1200 820 S 1700 800, 1920 830 V1080 H0 Z" fill="url(#paddy)" />
      <path d="M0 960 C 500 910, 1000 950, 1400 930 S 1800 920, 1920 940 V1080 H0 Z" fill="#0B3A27" />
      {Array.from({ length: 18 }, (_, i) => {
        const x = 60 + i * 108;
        const y = 790 + (i % 3) * 40;
        const grow = ramp(g, 0.2 + i * 0.18, 1.2);
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${sway * (i % 2 ? 1 : -1)}) scale(${grow})`}>
            <path d="M0 0 C -4 -26, -16 -40, -26 -48" stroke="#7FD1A6" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M0 0 C 4 -30, 14 -46, 24 -56" stroke="#9BE0B8" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M0 0 V -60" stroke="#7FD1A6" strokeWidth="4" strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
};

export const Hook: React.FC<SceneProps> = ({ start, end }) => (
  <SceneShell start={start} end={end} dark>
    {(g) => {
      const cursor = ramp(g, 0.3, 7.2);
      const sunY = lerp(760, 470, ramp(g, 0, 9));
      const costs = [
        { label: 'Seed', t: 3.0, x: 360 },
        { label: 'Fertilizer', t: 3.8, x: 560 },
        { label: 'Labour', t: 4.7, x: 790 },
      ];
      const gapT = pop(g, at(0, 3), 16);
      const rare = pop(g, at(0, 4), 14);
      return (
        <>
          <AbsoluteFill style={{ background: 'linear-gradient(180deg, #0B2E21 0%, #14503A 52%, #C9873A 78%, #F5B52E 100%)' }} />
          <div style={{ position: 'absolute', left: 1640, top: sunY + 120, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, #FFE3A3 0%, #F5B52E 55%, rgba(245,181,46,0) 72%)' }} />
          <Hills g={g} />
          <Chrome dark />
          {/* headline */}
          <div style={{ position: 'absolute', left: 120, top: 130 }}>
            <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -1.5, opacity: pop(g, 0.1), transform: `translateY(${(1 - pop(g, 0.1)) * 30}px)` }}>Costs come first.</div>
            <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -1.5, color: C.amber, opacity: pop(g, 5.4), transform: `translateY(${(1 - pop(g, 5.4)) * 30}px)` }}>Harvest money comes later.</div>
          </div>
          {/* timeline */}
          <div style={{ position: 'absolute', left: 140, top: 430, width: 1300 }}>
            <div style={{ position: 'absolute', left: 0, top: 70, width: 1300, height: 6, borderRadius: 3, background: 'rgba(246,247,244,0.25)' }} />
            <div style={{ position: 'absolute', left: 0, top: 70, width: 1300 * cursor, height: 6, borderRadius: 3, background: C.paper }} />
            {[
              { x: 0, label: 'Planting', icon: <Leaf size={34} color={C.deep} /> },
              { x: 1300, label: 'Harvest', icon: <Wheat size={34} color={C.deep} /> },
            ].map((n, i) => (
              <div key={n.label} style={{ position: 'absolute', left: n.x - 40, top: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: pop(g, i ? 5.0 : 0.3) }}>
                <div style={{ width: 80, height: 80, borderRadius: 40, background: i ? C.amber : '#9BE0B8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{n.label}</div>
              </div>
            ))}
            <div style={{ position: 'absolute', left: 1300 * cursor - 14, top: 59, width: 28, height: 28, borderRadius: 14, background: C.amber, boxShadow: '0 0 24px rgba(245,181,46,0.9)' }} />
            {costs.map((c) => {
              const p = pop(g, c.t);
              return (
                <div key={c.label} style={{ position: 'absolute', left: c.x - 90, top: -40 + (1 - p) * -30, width: 180, textAlign: 'center', opacity: p, fontSize: 26, fontWeight: 700, color: C.deep, background: '#FBE8E6', borderRadius: 999, padding: '8px 0' }}>
                  − {c.label}
                </div>
              );
            })}
            <div style={{ position: 'absolute', left: 1300 - 120, top: -40, width: 240, textAlign: 'center', opacity: pop(g, 5.6), fontSize: 26, fontWeight: 700, color: C.deep, background: '#E3F1E8', borderRadius: 999, padding: '8px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              <Coins size={26} /> + Sales income
            </div>
            {/* gap bracket */}
            <div style={{ position: 'absolute', left: 420, top: 150, width: 640, height: 60, borderLeft: `4px solid ${C.amber}`, borderRight: `4px solid ${C.amber}`, borderBottom: `4px solid ${C.amber}`, borderRadius: '0 0 18px 18px', opacity: gapT, transform: `scaleX(${0.6 + gapT * 0.4})` }} />
            <div style={{ position: 'absolute', left: 420, top: 228, width: 640, textAlign: 'center', fontSize: 34, fontWeight: 700, color: C.amber, opacity: gapT }}>A predictable cash gap</div>
            <div style={{ position: 'absolute', left: 440, top: 284, width: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, fontSize: 28, fontWeight: 600, whiteSpace: 'nowrap', color: C.paper, opacity: rare, background: 'rgba(11,46,33,0.8)', borderRadius: 999, padding: '10px 0' }}>
              <Ruler size={28} /> …that almost nobody measures
            </div>
          </div>
          {/* cash meter */}
          <div style={{ position: 'absolute', left: 1500, top: 160, width: 300, opacity: pop(g, 0.6) }}>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 2, color: '#CFE3D8' }}>CASH IN THE BANK</div>
            <div style={{ marginTop: 12, height: 26, borderRadius: 13, background: 'rgba(246,247,244,0.2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(4, (1 - interpolate(cursor, [0, 0.55], [0, 1], { extrapolateRight: 'clamp' })) * 100)}%`, background: cursor > 0.4 ? '#E5533D' : '#7FD1A6', borderRadius: 13 }} />
            </div>
          </div>
        </>
      );
    }}
  </SceneShell>
);

/* ------------------------------------------------------------------ 2 Problem */
export const Problem: React.FC<SceneProps> = ({ start, end }) => (
  <SceneShell start={start} end={end}>
    {(g) => {
      const cards = [
        { t: at(1, 0), icon: <Percent size={48} color={C.amberDark} />, bg: C.amberTint, accent: C.amber, title: 'Chosen by headline rate', body: 'The lowest percentage looks like the best loan.' },
        { t: at(1, 1), icon: <CalendarClock size={48} color={C.blue} />, bg: C.blueTint, accent: C.blue, title: 'Timing ignored', body: 'When does the money arrive? When must it be repaid?' },
        { t: at(1, 3), icon: <Bot size={48} color={C.red} />, bg: C.redTint, accent: C.red, title: 'Unsafe automation', body: 'An AI that moves money or invents numbers.' },
      ];
      const stamp = pop(g, at(1, 4), 10);
      const shake = Math.sin(g * 1.4) * 6 * interpolate(g, [vf(at(1, 4)), vf(at(1, 4)) + 14], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      return (
        <>
          <LightBg />
          <Chrome dark={false} />
          <div style={{ position: 'absolute', left: 120, top: 150 }}>
            <Kicker>The problem</Kicker>
            <div style={{ marginTop: 22, fontSize: 72, fontWeight: 700, letterSpacing: -1.5, maxWidth: 1500, opacity: pop(g, at(1, 0)) }}>Borrowing blind, before the harvest</div>
          </div>
          <div style={{ position: 'absolute', left: 120, top: 430, width: 1680, display: 'flex', gap: 40 }}>
            {cards.map((c, i) => {
              const p = pop(g, c.t);
              return (
                <Card key={c.title} accent={c.accent} style={{ flex: 1, padding: 44, opacity: p, transform: `translateY(${(1 - p) * 60}px) ${i === 2 ? `translateX(${shake}px)` : ''}`, position: 'relative' }}>
                  <IconBadge bg={c.bg}>{c.icon}</IconBadge>
                  <div style={{ marginTop: 26, fontSize: 40, fontWeight: 700 }}>{c.title}</div>
                  <div style={{ marginTop: 12, fontSize: 30, lineHeight: 1.35, color: C.muted }}>{c.body}</div>
                  {i === 2 ? (
                    <div style={{ position: 'absolute', right: 26, top: 26, transform: `rotate(-8deg) scale(${0.6 + stamp * 0.4})`, opacity: stamp, border: `4px solid ${C.red}`, color: C.red, fontSize: 26, fontWeight: 800, letterSpacing: 1.5, padding: '6px 16px', borderRadius: 10 }}>
                      WORSE, NOT BETTER
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </>
      );
    }}
  </SceneShell>
);


/* ------------------------------------------------------------------ 3 Meet FarmLink */
export const Meet: React.FC<SceneProps> = ({ start, end }) => (
  <SceneShell start={start} end={end} dark>
    {(g) => {
      const logo = pop(g, at(2, 0), 12);
      const lift = ramp(g, at(2, 1) - 0.2, 0.8);
      const steps = [
        { t: at(2, 1), label: 'Records', icon: FileSpreadsheet },
        { t: at(2, 1) + 1.0, label: 'Forecast', icon: ChartLine },
        { t: at(2, 2), label: 'Compare', icon: Scale },
        { t: at(2, 3), label: 'Application', icon: FileText },
        { t: at(2, 4), label: 'Human submits', icon: UserCheck, human: true },
      ];
      return (
        <>
          <DarkBg />
          <Chrome dark />
          <AbsoluteFill style={{ alignItems: 'center', top: lerp(300, 150, lift) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 28, transform: `scale(${(0.7 + logo * 0.3) * lerp(1, 0.78, lift)})`, opacity: logo }}>
              <div style={{ width: 140, height: 140, borderRadius: 42, background: 'rgba(245,181,46,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Leaf size={92} color={C.amber} />
              </div>
              <div style={{ fontSize: 140, fontWeight: 700, letterSpacing: -3 }}>
                FarmLink <span style={{ color: C.amber }}>AI</span>
              </div>
            </div>
            <div style={{ marginTop: 18, fontSize: 42, color: '#CFE3D8', opacity: pop(g, at(2, 0) + 1.2) }}>A finance copilot for agricultural cooperatives</div>
          </AbsoluteFill>
          <div style={{ position: 'absolute', left: 140, top: 560, width: 1640, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {steps.map((s, i) => {
              const p = pop(g, s.t);
              const Icon = s.icon;
              return (
                <React.Fragment key={s.label}>
                  {i > 0 ? <div style={{ flex: 1, height: 5, margin: '0 10px 50px', borderRadius: 3, background: `linear-gradient(90deg, rgba(245,181,46,${p}), rgba(127,209,166,${p}))`, transform: `scaleX(${p})`, transformOrigin: 'left' }} /> : null}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, opacity: p, transform: `translateY(${(1 - p) * 40}px) scale(${s.human ? 1 + 0.08 * Math.sin(g / 8) * p : 1})` }}>
                    <div style={{ width: 136, height: 136, borderRadius: 40, background: s.human ? C.amber : 'rgba(246,247,244,0.1)', border: s.human ? 'none' : '2px solid rgba(246,247,244,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: s.human ? '0 0 50px rgba(245,181,46,0.55)' : 'none' }}>
                      <Icon size={64} color={s.human ? C.deep : C.paper} strokeWidth={1.8} />
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 700, color: s.human ? C.amber : C.paper }}>{s.label}</div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </>
      );
    }}
  </SceneShell>
);
