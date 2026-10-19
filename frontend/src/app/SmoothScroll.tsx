import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

const LenisContext = createContext<Lenis | null>(null);
let current: Lenis | null = null;

/** Pause smooth scrolling while a modal owns the scroll (dialogs, command palette). */
export function pauseSmoothScroll(paused: boolean) {
  if (!current) return;
  if (paused) current.stop();
  else current.start();
}

/** Lenis smooth scrolling. Disabled for users who prefer reduced motion. */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const l = new Lenis({ autoRaf: true, lerp: 0.12, wheelMultiplier: 1, smoothWheel: true });
    current = l;
    setLenis(l);
    return () => {
      l.destroy();
      current = null;
    };
  }, []);
  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}

export function useLenis() {
  return useContext(LenisContext);
}

/** Smoothly scrolls to an element id (falls back to native scrolling). */
export function useScrollTo() {
  const lenis = useLenis();
  return (target: string | number, opts: { immediate?: boolean; offset?: number } = {}) => {
    if (lenis) {
      lenis.scrollTo(typeof target === 'number' ? target : `#${target}`, { offset: opts.offset ?? -24, immediate: opts.immediate, duration: 1.1 });
      return;
    }
    if (typeof target === 'number') window.scrollTo({ top: target, behavior: opts.immediate ? 'auto' : 'smooth' });
    else document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
  };
}
