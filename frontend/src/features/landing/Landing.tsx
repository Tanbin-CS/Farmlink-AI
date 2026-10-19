import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  FileCheck2,
  Fingerprint,
  Github,
  Hand,
  Landmark,
  ListChecks,
  LockKeyhole,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Timer,
  XCircle,
} from 'lucide-react';
import { compareFinancing, demoCatalog, demoEvents, demoWorkspace, formatCivilDate, formatMoney, projectCashflow, toChartNumber, todayInBusinessZone, TRUTH_LABELS } from '@farmlink/engine';
import { buttonVariants } from '@/components/ui/button';
import { SandboxBanner } from '@/components/common';
import { DemoLauncher } from '@/components/DemoLauncher';
import { useSandbox } from '@/state/SandboxProvider';
import { config, liveModeConfigured } from '@/lib/config';
import { Brand } from '@/app/AppShell';
import { cn } from '@/lib/utils';
import { Reveal, motion } from '@/components/motion';
import { useScrollTo } from '@/app/SmoothScroll';

const STEPS = [
  { icon: ListChecks, title: 'Add your records', text: 'Planned sales, input purchases, wages, transport. Type them in or import a CSV.' },
  { icon: BarChart3, title: 'See the gap coming', text: 'A day-by-day forecast shows when cash runs out, how deep the hole is, and when harvest money refills it.' },
  { icon: Landmark, title: 'Compare honestly', text: 'Each option is sized to your gap, checked for timing and repayment, stress-tested, and explained.' },
  { icon: FileCheck2, title: 'You decide', text: 'The copilot prepares the application, then stops. Nothing is submitted until you confirm the exact terms.' },
];

const SAFEGUARDS = [
  { icon: Hand, title: 'Human confirmation only', text: 'The AI has no tool to confirm, approve, or move money. Only your button press can.' },
  { icon: Fingerprint, title: 'Exact-terms binding', text: 'The reviewed payload is hashed (SHA-256). Any change after review cancels the confirmation.' },
  { icon: Timer, title: 'Expiry and idempotency', text: 'Confirmations expire in 5 minutes. A double click or retry can never submit twice.' },
  { icon: ShieldCheck, title: 'Allowlisted tools', text: 'Every model proposal is checked against an allowlist and a strict schema before code runs it.' },
  { icon: Bot, title: 'Prompt-injection tested', text: 'Instructions hidden in records are treated as data. Tests show they cannot trigger actions.' },
  { icon: ScrollText, title: 'Full audit trail', text: 'Every tool call, block, and decision is logged and can be exported as evidence.' },
];

function usePreview() {
  return useMemo(() => {
    const asOf = todayInBusinessZone();
    const ws = demoWorkspace(asOf, 'preview', 'USD');
    const events = demoEvents(asOf, 'USD');
    const cf = projectCashflow(ws, events);
    const cmp = compareFinancing(ws, events, demoCatalog('USD'), 1, cf);
    const best = cmp.evaluations.find((e) => e.productId === cmp.bestFitProductId);
    return { cf, best, data: cf.days.map((d) => ({ d: d.date, v: toChartNumber(d.closingMinor) })) };
  }, []);
}

const heroItem = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } } };

export function Landing() {
  const { snapshot } = useSandbox();
  const { cf, best, data } = usePreview();
  const scrollTo = useScrollTo();

  return (
    <div className="min-h-screen bg-hero">
      <SandboxBanner />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Brand />
        <nav className="flex items-center gap-1 text-sm">
          <button onClick={() => scrollTo('how')} className="hidden rounded-lg px-3 py-2 text-stone-700 hover:bg-white/60 sm:block">
            How it works
          </button>
          <button onClick={() => scrollTo('safeguards')} className="hidden rounded-lg px-3 py-2 text-stone-700 hover:bg-white/60 sm:block">
            Safeguards
          </button>
          <a href={config.repoUrl} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-stone-700 hover:bg-white/60" target="_blank" rel="noreferrer">
            <Github className="size-4" aria-hidden /> <span className="hidden sm:inline">Source</span>
          </a>
          {snapshot?.workspace ? (
            <Link to="/workspace" className={buttonVariants({ size: 'sm' })}>
              Open workspace
            </Link>
          ) : null}
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-6 lg:grid-cols-[1.05fr_1fr] lg:pt-12">
        <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}>
          <motion.p variants={heroItem} className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-brand-800 shadow-sm ring-1 ring-brand-200">
            <Sparkles className="size-3.5 text-harvest-500" aria-hidden /> FinTechathon 2026 · Topic E · SME Finance Copilot
          </motion.p>
          <motion.h1 variants={heroItem} className="text-4xl font-semibold leading-[1.08] tracking-tight text-stone-900 sm:text-5xl lg:text-[56px]">
            Bridge the gap between <span className="text-brand-700">planting</span> and <span className="text-harvest-500">harvest</span>.
          </motion.h1>
          <motion.p variants={heroItem} className="mt-5 max-w-xl text-lg leading-relaxed text-stone-600">
            FarmLink AI helps farming cooperatives see a cash shortfall weeks before it happens, compare financing that truly fits, and prepare an application that only a
            human can submit.
          </motion.p>
          <motion.div variants={heroItem} className="mt-8 flex flex-col gap-3">
            <DemoLauncher size="lg" navigateTo="/workspace" label="Try the demo" />
            <Link to={snapshot?.workspace ? '/workspace' : '/setup'} className={cn(buttonVariants({ variant: 'link' }), 'w-fit px-0')}>
              {snapshot?.workspace ? 'Continue my workspace' : 'Or set up my own business'} <ArrowRight aria-hidden />
            </Link>
          </motion.div>
          <motion.ul variants={heroItem} className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-600">
            <li className="flex items-center gap-1.5">
              <LockKeyhole className="size-4 text-brand-600" aria-hidden /> No sign-up, data stays in your browser
            </li>
            <li className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-brand-600" aria-hidden /> Works in BDT, USD, or EUR
            </li>
            <li className="flex items-center gap-1.5">
              <Bot className="size-4 text-brand-600" aria-hidden /> {liveModeConfigured ? 'Live AI agent available' : 'Guided mode, no live AI in this build'}
            </li>
          </motion.ul>
        </motion.div>

        {/* Live preview computed from the fictional demo with the real engine */}
        <motion.div
          className="relative"
          aria-label="Preview of the demo dashboard"
          initial={{ opacity: 0, y: 24, rotate: 1.5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        >
          <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-200/40 to-harvest-100/50 blur-2xl" aria-hidden />
          <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-lift)] ring-1 ring-stone-200/80">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-stone-500">Demo cooperative · USD</div>
                <div className="mt-0.5 text-lg font-semibold">
                  Cash runs out on <span className="text-red-700">{cf.earliestNegativeDate ? formatCivilDate(cf.earliestNegativeDate) : '—'}</span>
                </div>
              </div>
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">Gap {formatMoney(cf.fundingGapMinor, 'USD', { decimals: false })}</span>
            </div>
            <div className="mt-4 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="lpFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#259863" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#259863" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="d" hide />
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                  <Area type="stepAfter" dataKey="v" stroke="#187a4f" strokeWidth={2} fill="url(#lpFill)" animationDuration={1400} animationBegin={350} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {best?.quote ? (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-brand-50 p-3 ring-1 ring-brand-100">
                <span className="grid size-10 place-items-center rounded-xl bg-white text-brand-700 shadow-sm">
                  <Landmark className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{best.productName}</div>
                  <div className="text-xs text-stone-600">
                    Borrow {formatMoney(best.quote.principalMinor, 'USD', { decimals: false })} · cost {formatMoney(best.quote.totalFinancingCostMinor, 'USD', { decimals: false })}
                  </div>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-brand-800 ring-1 ring-brand-200">Fits</span>
              </div>
            ) : null}
            <motion.div
              className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-harvest-400/60 bg-harvest-50 p-3 text-sm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.4 }}
            >
              <motion.span animate={{ rotate: [0, -14, 10, -6, 0] }} transition={{ delay: 1.5, duration: 0.8, repeat: Infinity, repeatDelay: 3 }} className="inline-flex">
                <Hand className="size-4 shrink-0 text-amber-700" aria-hidden />
              </motion.span>
              <span className="text-amber-950">Application prepared. Waiting for your confirmation.</span>
            </motion.div>
          </div>
        </motion.div>
      </section>

      <section id="how" className="border-y border-stone-200/80 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Reveal>
            <h2 className="text-center text-3xl font-semibold tracking-tight">From records to a decision in four steps</h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-stone-600">Every number comes from deterministic, tested code. The AI explains and proposes; it never does the arithmetic or the deciding.</p>
          </Reveal>
          <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="lift relative rounded-2xl bg-stone-50 p-5 ring-1 ring-stone-200/80"
              >
                <span className="absolute right-4 top-4 text-4xl font-bold text-stone-200" aria-hidden>
                  {i + 1}
                </span>
                <span className="grid size-10 place-items-center rounded-xl bg-brand-gradient text-white shadow-sm">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-stone-600">{s.text}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      <section id="safeguards" className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">AI as a financial participant, with guardrails</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Safe by design, not by prompt</h2>
            <p className="mt-3 text-stone-600">
              Permissions are enforced in code at the tool boundary. The model can analyse and prepare, but authority stays with the human.
            </p>
            <div className="mt-6 grid gap-3 text-sm">
              <div className="rounded-2xl bg-white p-4 ring-1 ring-emerald-200">
                <div className="flex items-center gap-2 font-semibold text-emerald-800">
                  <CheckCircle2 className="size-4" aria-hidden /> Implemented
                </div>
                <p className="mt-1 text-stone-600">Forecasts, financing matching, stress tests, sandbox applications, receipts, and evidence export.</p>
              </div>
              <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                <div className="flex items-center gap-2 font-semibold text-stone-700">
                  <XCircle className="size-4" aria-hidden /> Not included
                </div>
                <p className="mt-1 text-stone-600">Real loans, payments, lender integrations, identity checks, blockchain, or crop and price predictions.</p>
              </div>
            </div>
          </Reveal>
          <ul className="grid gap-4 sm:grid-cols-2">
            {SAFEGUARDS.map((s, i) => (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: (i % 2) * 0.08 + Math.floor(i / 2) * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="lift rounded-2xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-stone-200/80"
              >
                <s.icon className="size-5 text-brand-600" aria-hidden />
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-stone-600">{s.text}</p>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <Reveal className="flex flex-col items-start gap-5 rounded-3xl bg-brand-gradient p-8 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">See the demo cooperative&apos;s gap, and how to close it.</h2>
            <p className="mt-1 text-brand-100/90">Takes about a minute. No account needed.</p>
          </div>
          <DemoLauncher size="lg" navigateTo="/workspace" label="Start the demo" className="[&_[role=radiogroup]]:bg-white/15 [&_[role=radio]]:text-white/80" />
        </Reveal>
      </section>

      <footer className="border-t border-stone-200/80 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <span>{TRUTH_LABELS.prototype}</span>
          <span>
            Build {config.buildSha.slice(0, 7)} ·{' '}
            <Link to="/about" className="underline">
              About, limits, prior work
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
