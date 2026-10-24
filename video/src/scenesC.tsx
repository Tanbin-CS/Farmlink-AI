import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { Bot, Calculator, Check, Globe, LoaderCircle, Lock, MousePointer2, RefreshCcw, ScrollText, ShieldCheck, TriangleAlert, User, X } from 'lucide-react';
import { C, MONO } from './theme';
import { Card, Chrome, DarkBg, IconBadge, Kicker, Leaf, LightBg, SceneShell, lerp, pop, ramp } from './kit';
import { at } from './scenesA';
import { FPS, vf } from './timing';

type SceneProps = { start: number; end: number };

/* ------------------------------------------------------------------ 7 AI agent */
const TOOLS = ['calculate_cashflow', 'match_financing_options', 'run_stress_test', 'create_application_draft', 'prepare_sandbox_submission'];
export const Agent: React.FC<SceneProps> = ({ start, end }) => (
  <SceneShell start={start} end={end}>
    {(g) => {
      const ask = 'Prepare a sandbox application with the best option.';
      const typed = Math.round(ask.length * ramp(g, at(6, 0) + 0.2, 1.6));
      const toolStart = at(6, 1) + 0.6;
      const stop = pop(g, at(6, 5) + 0.6);
      return (
        <>
          <LightBg />
          <Chrome dark={false} />
          <div style={{ position: 'absolute', left: 120, top: 128 }}>
            <Kicker>Live AI agent · Gemini</Kicker>
            <div style={{ marginTop: 18, fontSize: 62, fontWeight: 700, letterSpacing: -1.2, opacity: pop(g, at(6, 0)) }}>The AI plans. Tested code calculates.</div>
          </div>
          {/* chat */}
          <Card style={{ position: 'absolute', left: 120, top: 330, width: 760, height: 560, padding: 36, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ alignSelf: 'flex-end', maxWidth: 560, display: 'flex', gap: 14, alignItems: 'flex-start', opacity: pop(g, at(6, 0)) }}>
              <div style={{ background: C.green, color: '#fff', fontSize: 30, lineHeight: 1.35, padding: '18px 24px', borderRadius: '22px 22px 6px 22px' }}>
                {ask.slice(0, typed)}
                <span style={{ opacity: typed < ask.length && Math.floor(g / 8) % 2 ? 1 : 0 }}>|</span>
              </div>
              <IconBadge bg={C.mint} size={56}>
                <User size={30} color={C.green} />
              </IconBadge>
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', opacity: pop(g, at(6, 1)) }}>
              <IconBadge bg={C.amberTint} size={56}>
                <Bot size={30} color={C.amberDark} />
              </IconBadge>
              <div style={{ background: '#F1F4F2', fontSize: 28, lineHeight: 1.4, padding: '18px 24px', borderRadius: '22px 22px 22px 6px', maxWidth: 560 }}>
                Planning: forecast → compare → stress-test → draft → prepare for your review.
              </div>
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: 16 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, background: C.mint, borderRadius: 18, padding: '16px 20px', fontSize: 26, fontWeight: 700, color: C.green, opacity: pop(g, at(6, 3)) }}>
                <Calculator size={30} /> Numbers from tested code
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, background: C.redTint, borderRadius: 18, padding: '16px 20px', fontSize: 26, fontWeight: 700, color: C.red, opacity: pop(g, at(6, 4)), position: 'relative' }}>
                <Bot size={30} /> <span style={{ textDecoration: 'line-through', textDecorationThickness: 3 }}>AI guesses</span>
              </div>
            </div>
          </Card>
          {/* tool calls */}
          <Card style={{ position: 'absolute', left: 920, top: 330, width: 880, padding: '28px 36px', boxSizing: 'border-box' }}>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2, color: C.muted, marginBottom: 10 }}>TOOL CALLS · ALLOWLISTED</div>
            {TOOLS.map((t, i) => {
              const ts = toolStart + i * 0.85;
              const p = pop(g, ts);
              const done = g >= vf(ts + 0.6);
              const last = i === TOOLS.length - 1;
              return (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 0', borderBottom: i < 4 ? `1px solid ${C.line}` : 'none', opacity: p, transform: `translateX(${(1 - p) * 40}px)` }}>
                  <div style={{ width: 44, height: 44, borderRadius: 22, background: done ? (last ? C.amber : C.green) : '#EEF1EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {done ? last ? <Lock size={24} color={C.deep} /> : <Check size={26} color="#fff" strokeWidth={3} /> : <LoaderCircle size={26} color={C.muted} style={{ transform: `rotate(${g * 12}deg)` }} />}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 28, color: C.ink }}>{t}</div>
                </div>
              );
            })}
            <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 14, background: C.amberTint, borderRadius: 18, padding: '18px 22px', fontSize: 30, fontWeight: 700, color: '#6B4500', opacity: stop, transform: `scale(${0.92 + 0.08 * stop})` }}>
              <Lock size={32} /> Stopped. Waiting for a human to confirm.
            </div>
          </Card>
        </>
      );
    }}
  </SceneShell>
);

/* ------------------------------------------------------------------ 8 Human in control */
export const Human: React.FC<SceneProps> = ({ start, end }) => (
  <SceneShell start={start} end={end}>
    {(g) => {
      const tick1 = g >= vf(at(7, 0) + 1.0);
      const tick2 = g >= vf(at(7, 0) + 1.6);
      const cur = ramp(g, at(7, 0) + 1.9, 0.8);
      const clicked = g >= vf(at(7, 0) + 2.8);
      const press = clicked ? interpolate(g - vf(at(7, 0) + 2.8), [0, 4, 8], [1, 0.94, 1], { extrapolateRight: 'clamp' }) : 1;
      const side = [
        { t: at(7, 1), icon: <RefreshCcw size={40} color={C.red} />, bg: C.redTint, title: 'Changed after review?', body: 'The confirmation is cancelled. Review again.', stamp: 'CANCELLED' },
        { t: at(7, 3), icon: <ShieldCheck size={40} color={C.green} />, bg: C.mint, title: 'No real money moves', body: 'A sandbox simulator receives the application.' },
        { t: at(7, 4), icon: <ScrollText size={40} color={C.blue} />, bg: C.blueTint, title: 'Every step logged', body: 'Exportable evidence: tools, decisions, receipt.' },
      ];
      const rows: [string, string][] = [
        ['Principal', 'BDT 429,797.98'],
        ['Upfront fee', 'BDT 4,797.98'],
        ['Interest (simple)', 'BDT 9,714.61'],
        ['Repay on 5 Jan 2027', 'BDT 439,512.59'],
      ];
      const box = (on: boolean) => (
        <div style={{ width: 34, height: 34, flex: 'none', borderRadius: 8, border: `3px solid ${on ? C.green : '#9AA59F'}`, background: on ? C.green : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {on ? <Check size={24} color="#fff" strokeWidth={3.5} /> : null}
        </div>
      );
      return (
        <>
          <LightBg />
          <Chrome dark={false} />
          <div style={{ position: 'absolute', left: 120, top: 128 }}>
            <Kicker>Human in control</Kicker>
            <div style={{ marginTop: 18, fontSize: 62, fontWeight: 700, letterSpacing: -1.2, opacity: pop(g, at(7, 0)) }}>Only a person can confirm</div>
          </div>
          <Card style={{ position: 'absolute', left: 120, top: 320, width: 880, padding: '30px 40px', boxSizing: 'border-box', opacity: pop(g, at(7, 0)), transform: `translateY(${(1 - pop(g, at(7, 0))) * 40}px)` }}>
            <div style={{ fontSize: 32, fontWeight: 700 }}>Review and confirm sandbox submission</div>
            <div style={{ marginTop: 14, borderRadius: 16, border: `1px solid ${C.line}`, padding: '6px 22px' }}>
              {rows.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, padding: '9px 0' }}>
                  <span style={{ color: C.muted }}>{k}</span>
                  <span style={{ fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, background: '#FDF0EE', color: C.red, borderRadius: 14, padding: '12px 18px', fontSize: 25, fontWeight: 700 }}>
              <TriangleAlert size={28} /> Repayment risk: survives 0 of 4 stress scenarios
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 14, alignItems: 'center', fontSize: 24 }}>
              {box(tick1)} I reviewed these exact terms (payload hash bound)
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 14, alignItems: 'center', fontSize: 24 }}>
              {box(tick2)} I understand the repayment risk
            </div>
            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ background: clicked ? C.deep : C.green, color: '#fff', fontSize: 28, fontWeight: 700, padding: '16px 30px', borderRadius: 14, transform: `scale(${press})` }}>
                {clicked ? '✓ Sandbox receipt issued' : 'Confirm sandbox submission'}
              </div>
            </div>
            <div style={{ position: 'absolute', left: lerp(380, 680, cur), top: lerp(330, 560, cur), opacity: cur > 0 && g < vf(at(7, 1)) ? 1 : 0 }}>
              <MousePointer2 size={52} color={C.deep} fill="#fff" strokeWidth={2} />
            </div>
          </Card>
          <div style={{ position: 'absolute', left: 1050, top: 320, width: 750, display: 'flex', flexDirection: 'column', gap: 22 }}>
            {side.map((s) => {
              const p = pop(g, s.t);
              const stampP = s.stamp ? pop(g, at(7, 2), 10) : 0;
              return (
                <Card key={s.title} style={{ padding: '24px 30px', paddingRight: s.stamp ? 210 : 30, display: 'flex', gap: 22, alignItems: 'center', opacity: p, transform: `translateX(${(1 - p) * 60}px)`, position: 'relative' }}>
                  <IconBadge bg={s.bg} size={78}>
                    {s.icon}
                  </IconBadge>
                  <div>
                    <div style={{ fontSize: 34, fontWeight: 700 }}>{s.title}</div>
                    <div style={{ fontSize: 25, color: C.muted, marginTop: 4 }}>{s.body}</div>
                  </div>
                  {s.stamp ? (
                    <div style={{ position: 'absolute', right: 24, top: '50%', marginTop: -20, transform: `rotate(-6deg) scale(${0.6 + 0.4 * stampP})`, opacity: stampP, border: `3px solid ${C.red}`, color: C.red, fontSize: 22, fontWeight: 800, letterSpacing: 1.5, padding: '4px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <X size={20} strokeWidth={3} /> {s.stamp}
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

/* ------------------------------------------------------------------ 9 Close */
export const Close: React.FC<SceneProps> = ({ start, end }) => (
  <SceneShell start={start} end={end} dark>
    {(g) => {
      const logo = pop(g, at(8, 0), 12);
      const l1 = pop(g, at(8, 1));
      const l2 = pop(g, at(8, 1) + 1.3);
      const url = pop(g, at(8, 2));
      const team = pop(g, at(8, 2) + 2.2);
      const glow = 0.5 + 0.5 * Math.sin(g / (FPS / 2));
      return (
        <>
          <DarkBg />
          <Chrome dark />
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 30, paddingBottom: 90 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, opacity: logo, transform: `scale(${0.75 + 0.25 * logo})` }}>
              <div style={{ width: 110, height: 110, borderRadius: 34, background: 'rgba(245,181,46,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Leaf size={72} color={C.amber} />
              </div>
              <div style={{ fontSize: 104, fontWeight: 700, letterSpacing: -2.5 }}>
                FarmLink <span style={{ color: C.amber }}>AI</span>
              </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: 70, fontWeight: 700, lineHeight: 1.15, letterSpacing: -1 }}>
              <div style={{ opacity: l1, transform: `translateY(${(1 - l1) * 24}px)` }}>The AI prepares.</div>
              <div style={{ opacity: l2, transform: `translateY(${(1 - l2) * 24}px)`, color: C.amber }}>The cooperative decides.</div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 16, fontSize: 40, fontWeight: 700, color: C.deep, background: C.amber, padding: '18px 36px', borderRadius: 999, opacity: url, transform: `scale(${0.85 + 0.15 * url})`, boxShadow: `0 0 ${30 + 30 * glow}px rgba(245,181,46,0.55)` }}>
              <Globe size={40} /> tanbin-cs.github.io/Farmlink-AI
            </div>
            <div style={{ fontSize: 30, color: '#CFE3D8', opacity: team, textAlign: 'center', lineHeight: 1.5 }}>
              Team FarmLink · American International University-Bangladesh
              <br />
              Md. Tanbin Islam (Leader) · Md. Rifat Ul Islam
            </div>
          </AbsoluteFill>
        </>
      );
    }}
  </SceneShell>
);
