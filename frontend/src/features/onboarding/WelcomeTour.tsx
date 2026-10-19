import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, BarChart3, Hand, Landmark, Sprout } from 'lucide-react';
import { formatCivilDate } from '@farmlink/engine';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSandbox } from '@/state/SandboxProvider';
import { useMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

const KEY = 'farmlink.tour.seen.v1';

function seen() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
}

/** A short story-driven tour shown the first time the demo is loaded. Skippable, shown once. */
export function WelcomeTour() {
  const { snapshot, cashflow, comparison } = useSandbox();
  const { fmt } = useMoney();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const isDemo = snapshot?.workspace?.provenance === 'sandbox_fixture';

  useEffect(() => {
    if (isDemo && !seen()) {
      const t = setTimeout(() => setOpen(true), 450);
      return () => clearTimeout(t);
    }
  }, [isDemo]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // ignore
    }
  };
  if (!cashflow) return null;
  const best = comparison?.evaluations.find((e) => e.productId === comparison.bestFitProductId);

  const slides = [
    {
      icon: Sprout,
      tone: 'from-brand-600 to-brand-800',
      title: 'Meet the demo cooperative',
      body: (
        <>
          A fictional rice cooperative is about to buy seed and fertilizer for its members. The harvest money only arrives about two months later. Let’s see whether its
          cash holds up in the meantime.
        </>
      ),
    },
    {
      icon: BarChart3,
      tone: 'from-red-600 to-orange-600',
      title: cashflow.earliestNegativeDate ? `Cash runs out on ${formatCivilDate(cashflow.earliestNegativeDate)}` : 'Cash stays positive',
      body: (
        <>
          The forecast replays every planned payment day by day. The deepest point is <strong>{fmt(cashflow.fundingGapMinor, { decimals: false })}</strong> below zero on{' '}
          {formatCivilDate(cashflow.minClosingDate)}. That gap is what financing has to cover, and in time.
        </>
      ),
    },
    {
      icon: Landmark,
      tone: 'from-amber-500 to-harvest-500',
      title: 'Compare honestly, then stress-test',
      body: (
        <>
          Eight fictional options are sized to the gap, checked for timing and repayment, and explained.
          {best ? (
            <>
              {' '}
              <strong>{best.productName}</strong> has the lowest modeled cost. The stress test then shows what happens if the harvest is late or prices drop.
            </>
          ) : null}
        </>
      ),
    },
    {
      icon: Hand,
      tone: 'from-sky-600 to-brand-700',
      title: 'You stay in control',
      body: (
        <>
          The copilot can prepare an application, but it can never submit one. You review the exact terms and confirm. Everything is a sandbox: no real loan, payment, or
          lender.
        </>
      ),
    },
  ];
  const s = slides[step]!;
  const last = step === slides.length - 1;
  const goto = (n: number) => {
    setDir(n > step ? 1 : -1);
    setStep(n);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <div className={cn('relative grid h-36 place-items-center bg-gradient-to-br text-white transition-colors duration-500', s.tone)}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={step}
              initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              className="grid size-16 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur"
            >
              <s.icon className="size-8" aria-hidden />
            </motion.span>
          </AnimatePresence>
          <span className="absolute left-4 top-3 text-xs font-medium text-white/80">
            {step + 1} / {slides.length}
          </span>
        </div>
        <div className="px-6 pb-6 pt-5">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div key={step} initial={{ opacity: 0, x: 24 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 * dir }} transition={{ duration: 0.22 }}>
              <DialogTitle className="text-xl">{s.title}</DialogTitle>
              <DialogDescription className="mt-2 text-[15px] leading-relaxed text-stone-600">{s.body}</DialogDescription>
            </motion.div>
          </AnimatePresence>
          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-1.5" role="tablist" aria-label="Tour steps">
              {slides.map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === step}
                  aria-label={`Step ${i + 1}`}
                  onClick={() => goto(i)}
                  className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-brand-600' : 'w-1.5 bg-stone-300 hover:bg-stone-400')}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {step > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => goto(step - 1)}>
                  <ArrowLeft aria-hidden /> Back
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={close}>
                  Skip
                </Button>
              )}
              {last ? (
                <Button
                  size="sm"
                  onClick={() => {
                    close();
                    navigate('/cashflow');
                  }}
                >
                  See the forecast <ArrowRight aria-hidden />
                </Button>
              ) : (
                <Button size="sm" onClick={() => goto(step + 1)}>
                  Next <ArrowRight aria-hidden />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
