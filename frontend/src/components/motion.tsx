import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from 'motion/react';
import type { MoneyMinor } from '@farmlink/engine';
import { useMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fades and lifts content in when it scrolls into view (once). */
export function Reveal({ children, className, delay = 0, y = 16 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -60px 0px' }}
      transition={{ duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({ children, className, gap = 0.06 }: { children: ReactNode; className?: string; gap?: number }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated money: counts from the previous value to the new one, then shows the exact
 * formatted amount. Animation uses display numbers only; the final text is exact.
 */
export function CountUpMoney({ value, className, decimals = false }: { value: MoneyMinor; className?: string; decimals?: boolean }) {
  const { fmt } = useMoney();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const prev = useRef<number>(0);
  const [text, setText] = useState(() => (reduce ? fmt(value, { decimals }) : fmt('0', { decimals })));
  useEffect(() => {
    const target = Number(value);
    if (reduce || !inView) {
      if (reduce) setText(fmt(value, { decimals }));
      return;
    }
    const controls = animate(prev.current, target, {
      duration: 0.9,
      ease: EASE,
      onUpdate: (v) => setText(fmt(String(Math.round(v)), { decimals })),
      onComplete: () => setText(fmt(value, { decimals })),
    });
    prev.current = target;
    return () => controls.stop();
  }, [value, inView, reduce, fmt, decimals]);
  return (
    <span ref={ref} className={cn('tabular', value.startsWith('-') && 'text-red-700', className)}>
      {text}
    </span>
  );
}

export function PageTransition({ children, id }: { children: ReactNode; id: string }) {
  return (
    <motion.div key={id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease: EASE }}>
      {children}
    </motion.div>
  );
}

export { motion, AnimatePresence, EASE };
