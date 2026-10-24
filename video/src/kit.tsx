import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, Easing } from 'remotion';
import { C, FONT } from './theme';
import { CUES, DURATION_FRAMES, FPS, vf } from './timing';

/** Spring from 0 to 1 that starts when the given voice second is reached. */
export const pop = (g: number, sec: number, damping = 14, mass = 0.8) =>
  spring({ frame: g - vf(sec), fps: FPS, config: { damping, mass, stiffness: 120 } });

/** Smooth 0..1 ramp starting at the given voice second. */
export const ramp = (g: number, sec: number, dur = 0.5) =>
  interpolate(g, [vf(sec), vf(sec) + dur * FPS], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Wraps a scene: fades and lifts it in, fades it out at the end. */
export const SceneShell: React.FC<{ start: number; end: number; children: (g: number) => React.ReactNode; dark?: boolean }> = ({ start, end, children, dark }) => {
  const f = useCurrentFrame();
  const g = f + start;
  const len = end - start;
  const inT = interpolate(f, [0, 14], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const outT = interpolate(f, [len - 10, len], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ opacity: Math.min(inT, outT), transform: `translateY(${(1 - inT) * 24}px) scale(${0.985 + inT * 0.015})`, color: dark ? C.paper : C.ink, fontFamily: FONT }}>
      {children(g)}
    </AbsoluteFill>
  );
};

/** Light brand background with slowly drifting soft glows. */
export const LightBg: React.FC = () => {
  const f = useCurrentFrame();
  const x = Math.sin(f / 140) * 60;
  const y = Math.cos(f / 170) * 40;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <div style={{ position: 'absolute', width: 1100, height: 1100, borderRadius: '50%', right: -300 + x, top: -420 + y, background: 'radial-gradient(circle, rgba(37,152,99,0.20), rgba(37,152,99,0) 65%)' }} />
      <div style={{ position: 'absolute', width: 900, height: 900, borderRadius: '50%', left: -360 - x, bottom: -520 - y, background: 'radial-gradient(circle, rgba(245,181,46,0.16), rgba(245,181,46,0) 65%)' }} />
      <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(20,98,65,0.10) 1.5px, transparent 1.5px)', backgroundSize: '36px 36px', maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0) 70%)' }} />
    </AbsoluteFill>
  );
};

/** Dark brand background (deep green) with glow. */
export const DarkBg: React.FC = () => {
  const f = useCurrentFrame();
  const x = Math.sin(f / 120) * 80;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(140deg, ${C.deep} 0%, ${C.forest} 55%, ${C.green} 100%)` }}>
      <div style={{ position: 'absolute', width: 1200, height: 1200, borderRadius: '50%', right: -380 + x, top: -500, background: 'radial-gradient(circle, rgba(245,181,46,0.22), rgba(245,181,46,0) 62%)' }} />
      <div style={{ position: 'absolute', width: 1000, height: 1000, borderRadius: '50%', left: -400 - x, bottom: -600, background: 'radial-gradient(circle, rgba(127,209,166,0.18), rgba(127,209,166,0) 62%)' }} />
    </AbsoluteFill>
  );
};

export const Kicker: React.FC<{ children: React.ReactNode; dark?: boolean; style?: React.CSSProperties }> = ({ children, dark, style }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 24, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: dark ? C.amber : C.green, background: dark ? 'rgba(245,181,46,0.12)' : C.mint, padding: '10px 22px', borderRadius: 999, ...style }}>
    {children}
  </div>
);

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; accent?: string }> = ({ children, style, accent }) => (
  <div style={{ background: C.white, borderRadius: 26, boxShadow: '0 18px 50px rgba(11,46,33,0.12)', borderTop: accent ? `7px solid ${accent}` : undefined, ...style }}>{children}</div>
);

export const IconBadge: React.FC<{ children: React.ReactNode; bg: string; size?: number }> = ({ children, bg, size = 84 }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.28, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{children}</div>
);

/** Burned-in English subtitles, one phrase at a time. */
export const Subtitles: React.FC = () => {
  const f = useCurrentFrame();
  const idx = CUES.findIndex((c, i) => {
    const next = CUES[i + 1];
    const endSec = next && next.start - c.end < 0.7 ? next.start : c.end + 0.35;
    return f >= vf(c.start) && f < vf(endSec);
  });
  if (idx < 0) return null;
  const c = CUES[idx];
  const t = interpolate(f, [vf(c.start), vf(c.start) + 6], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 46, pointerEvents: 'none' }}>
      <div style={{ maxWidth: 1560, textAlign: 'center', fontFamily: FONT, fontSize: 42, fontWeight: 600, lineHeight: 1.3, color: '#FFFFFF', background: 'rgba(8,30,22,0.84)', padding: '14px 32px', borderRadius: 18, boxShadow: '0 8px 30px rgba(0,0,0,0.25)', opacity: t, transform: `translateY(${(1 - t) * 10}px)` }}>
        {c.text}
      </div>
    </AbsoluteFill>
  );
};

/** Small brand mark and a thin progress bar shown during the narration. */
export const Chrome: React.FC<{ dark: boolean }> = ({ dark }) => {
  const f = useCurrentFrame();
  const p = f / DURATION_FRAMES;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', fontFamily: FONT }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: 6, width: `${p * 100}%`, background: `linear-gradient(90deg, ${C.green}, ${C.amber})` }} />
      <div style={{ position: 'absolute', left: 56, top: 40, display: 'flex', alignItems: 'center', gap: 12, fontSize: 26, fontWeight: 700, color: dark ? C.paper : C.deep, opacity: 0.9 }}>
        <Leaf size={30} color={dark ? C.amber : C.green} /> FarmLink <span style={{ color: dark ? C.amber : C.green }}>AI</span>
      </div>
      <div style={{ position: 'absolute', right: 56, top: 46, fontSize: 20, fontWeight: 600, letterSpacing: 1.5, color: dark ? 'rgba(246,247,244,0.7)' : C.muted }}>FINTECHATHON 2026 · TOPIC E</div>
    </AbsoluteFill>
  );
};

/** Simple sprout mark drawn in SVG (no external assets). */
export const Leaf: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 20h10" />
    <path d="M10 20c5.5-2.5.8-6.4 3-10" />
    <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
    <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
  </svg>
);
