import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, FileCheck2, Github, Landmark, LockKeyhole, ShieldCheck, Sprout } from 'lucide-react';
import { TRUTH_LABELS } from '@farmlink/engine';
import { Button, buttonVariants } from '@/components/ui/button';
import { SandboxBanner } from '@/components/common';
import { useSandbox } from '@/state/SandboxProvider';
import { config, liveModeConfigured } from '@/lib/config';
import { Brand } from '@/app/AppShell';
import { cn } from '@/lib/utils';

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Dated cash-flow forecast',
    text: 'Daily projection from your records with low-cash and negative-cash alerts, explicit assumptions, and an accessible table.',
  },
  {
    icon: Landmark,
    title: 'Transparent financing match',
    text: 'Finds the smallest principal whose net proceeds cover the gap, checks disbursement timing and repayment, and explains every rejection.',
  },
  {
    icon: FileCheck2,
    title: 'Human-confirmed sandbox submission',
    text: 'Drafts an application, freezes the exact payload, and submits to an internal simulator only after you review and confirm.',
  },
  {
    icon: ShieldCheck,
    title: 'Agent with guardrails',
    text: 'The AI can only propose allowlisted tools. Arithmetic, authorization, and confirmation are enforced in code, not in the prompt.',
  },
];

export function Landing() {
  const { snapshot, run } = useSandbox();
  const navigate = useNavigate();
  const startDemo = async () => {
    const r = await run('Load demo', (c) => c.loadDemo(), { success: 'Sandbox demo scenario loaded.' });
    if (r) navigate('/workspace');
  };

  return (
    <div className="min-h-screen">
      <SandboxBanner />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Brand />
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/about" className="rounded-md px-3 py-1.5 hover:bg-stone-100">
            About & limits
          </Link>
          <a href={config.repoUrl} className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 hover:bg-stone-100" target="_blank" rel="noreferrer">
            <Github className="size-4" aria-hidden /> Source
          </a>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:pt-14">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-900">
          <Sprout className="size-3.5" aria-hidden /> FinTechathon 2026 · International Track · Topic E: SME Finance Copilot
        </p>
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-stone-900 sm:text-5xl">
          See the cash gap before planting season. Compare financing honestly. Submit only when you say so.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-stone-700 sm:text-lg">
          FarmLink AI is a finance copilot for agricultural cooperatives and small agribusinesses. It turns sales and cost records into a dated
          cash-flow forecast, matches financing options against the real gap, and prepares a sandbox application that a human must confirm.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="lg" onClick={startDemo}>
            Start sandbox demo <ArrowRight aria-hidden />
          </Button>
          {snapshot?.workspace ? (
            <Link to="/workspace" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              Continue my workspace
            </Link>
          ) : (
            <Link to="/setup" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              Set up my own workspace
            </Link>
          )}
        </div>
        <ul className="mt-5 space-y-1 text-sm text-stone-600">
          <li className="flex items-center gap-2">
            <LockKeyhole className="size-4" aria-hidden /> No password. Guided mode keeps all data in this browser.
          </li>
          <li>
            Mode available now: <strong>Guided sandbox — no live AI</strong>
            {liveModeConfigured ? (
              <>
                {' '}
                and <strong>Live AI + sandbox tools</strong> (opt in from Setup)
              </>
            ) : (
              ' (live AI backend not configured for this build)'
            )}
            .
          </li>
          <li>{TRUTH_LABELS.input}</li>
        </ul>
      </section>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-stone-200 p-4">
              <f.icon className="mb-2 size-5 text-brand-800" aria-hidden />
              <h2 className="font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-stone-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-lg font-semibold">What this prototype is, and is not</h2>
        <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <h3 className="font-medium">Implemented</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-700">
              <li>Record entry and validated CSV import</li>
              <li>Deterministic integer-money cash-flow and financing engine</li>
              <li>Draft, exact-payload review, explicit confirmation, sandbox receipt</li>
              <li>Activity log and exportable execution evidence</li>
              <li>Optional live AI agent with allowlisted tools and server-side controls</li>
            </ul>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <h3 className="font-medium">Not included</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-700">
              <li>Real loans, payments, lender submissions, or approvals</li>
              <li>Identity verification, KYC, credit bureau, or government integrations</li>
              <li>Blockchain records, credentials, or crop-yield predictions</li>
              <li>Any claim of partnership with a bank, lender, or agency</li>
            </ul>
          </div>
        </div>
        <p className={cn('mt-6 text-xs text-stone-500')}>
          Build {config.buildSha.slice(0, 12)} · <Link to="/about" className="underline">About, limits, prior work</Link>
        </p>
      </section>
    </div>
  );
}
