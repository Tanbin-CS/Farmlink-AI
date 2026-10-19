import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  Check,
  FileText,
  Home,
  Info,
  Landmark,
  ListChecks,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  Sprout,
  X,
} from 'lucide-react';
import { useSandbox } from '@/state/SandboxProvider';
import { usePreferences } from '@/state/PreferencesProvider';
import { ModeBadge, SandboxBanner } from '@/components/common';
import { CopilotPanel } from '@/features/copilot/CopilotPanel';
import { useJourney } from '@/lib/journey';
import { cn } from '@/lib/utils';
import { DisplayCurrencySelect } from './DisplayCurrencySelect';
import { CommandButton } from './CommandPalette';
import { useLenis } from './SmoothScroll';
import { PageTransition } from '@/components/motion';
import { WelcomeTour } from '@/features/onboarding/WelcomeTour';

const STEP_ICON: Record<string, typeof Home> = {
  profile: Building2,
  records: ListChecks,
  forecast: BarChart3,
  financing: Landmark,
  apply: FileText,
};

export function Brand({ inverted }: { inverted?: boolean }) {
  return (
    <Link to="/" className={cn('flex items-center gap-2.5 font-semibold', inverted ? 'text-white' : 'text-brand-900')}>
      <span className={cn('grid size-9 place-items-center rounded-xl shadow-sm', inverted ? 'bg-white/10 text-brand-200 ring-1 ring-white/20' : 'bg-brand-gradient text-brand-100')}>
        <Sprout className="size-5" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] tracking-tight">FarmLink AI</span>
        <span className={cn('block text-[11px] font-medium', inverted ? 'text-brand-200/80' : 'text-stone-500')}>SME finance copilot</span>
      </span>
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { steps, completed, total } = useJourney();
  const { snapshot } = useSandbox();
  const item = (isActive: boolean) =>
    cn(
      'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
      isActive ? 'bg-white/10 font-medium text-white' : 'text-brand-100/80 hover:bg-white/5 hover:text-white',
    );
  return (
    <nav aria-label="Workspace" className="flex flex-col gap-6">
      <div>
        <NavLink to="/workspace" onClick={onNavigate} className={({ isActive }) => item(isActive)}>
          <Home className="size-4" aria-hidden /> Overview
        </NavLink>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-wider text-brand-200/70">
          <span>Your journey</span>
          <span aria-label={`${completed} of ${total} steps done`}>
            {completed}/{total}
          </span>
        </div>
        <div className="mx-3 mb-3 h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-harvest-400 transition-all" style={{ width: `${(completed / total) * 100}%` }} />
        </div>
        <ol className="flex flex-col gap-0.5">
          {steps.map((s) => {
            const Icon = STEP_ICON[s.id] ?? Home;
            return (
              <li key={s.id}>
                <NavLink to={s.to} onClick={onNavigate} className={({ isActive }) => item(isActive)}>
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ring-1',
                      s.done ? 'bg-brand-400 text-brand-950 ring-brand-300' : 'bg-transparent text-brand-100/80 ring-white/25',
                    )}
                  >
                    {s.done ? <Check className="size-3.5" aria-label="done" /> : s.n}
                  </span>
                  <span className="flex-1">{s.label}</span>
                  <Icon className="size-4 opacity-50 group-hover:opacity-80" aria-hidden />
                </NavLink>
              </li>
            );
          })}
        </ol>
      </div>
      <div>
        <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-brand-200/70">Audit</div>
        <NavLink to="/activity" onClick={onNavigate} className={({ isActive }) => item(isActive)}>
          <Activity className="size-4" aria-hidden /> Activity & evidence
          {snapshot?.toolEvents.length ? <span className="ml-auto rounded-full bg-white/10 px-1.5 text-[11px]">{snapshot.toolEvents.length}</span> : null}
        </NavLink>
        <NavLink to="/about" onClick={onNavigate} className={({ isActive }) => item(isActive)}>
          <Info className="size-4" aria-hidden /> About & limits
        </NavLink>
      </div>
    </nav>
  );
}

const MOBILE_TABS = [
  { to: '/workspace', label: 'Home', icon: Home },
  { to: '/records', label: 'Records', icon: ListChecks },
  { to: '/cashflow', label: 'Forecast', icon: BarChart3 },
  { to: '/financing', label: 'Finance', icon: Landmark },
  { to: '/applications', label: 'Apply', icon: FileText },
];

export function AppShell() {
  const outlet = useOutlet();
  const lenis = useLenis();
  const { client, snapshot } = useSandbox();
  const { prefs, update } = usePreferences();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const onCopilotRoute = location.pathname === '/copilot';
  const copilotOpen = prefs.copilotOpen;

  useEffect(() => {
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo({ top: 0 });
  }, [location.pathname, lenis]);

  return (
    <div className="flex min-h-screen flex-col">
      <SandboxBanner />
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between bg-brand-gradient p-4 lg:flex">
          <div className="flex flex-col gap-7">
            <div className="px-1 pt-1">
              <Brand inverted />
            </div>
            <SidebarNav />
          </div>
          <div className="space-y-3 rounded-xl bg-black/15 p-3 text-xs text-brand-100/90">
            <ModeBadge mode={client.mode} className="max-w-full" />
            <p className="leading-relaxed">No real money moves. Every submission goes to an internal simulator, and only after you confirm.</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="no-print sticky top-0 z-30 border-b border-stone-200/80 bg-white/85 backdrop-blur">
            <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
              <div className="lg:hidden">
                <Brand />
              </div>
              <div className="hidden min-w-0 items-center gap-2 lg:flex">
                <span className="truncate text-sm font-medium text-stone-800">{snapshot?.workspace?.businessName ?? 'No workspace yet'}</span>
                {snapshot?.workspace ? <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] font-semibold text-stone-600">{snapshot.workspace.currency}</span> : null}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <CommandButton />
                <DisplayCurrencySelect className="hidden sm:flex" />
                <button
                  className="hidden items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-xs hover:bg-stone-50 xl:flex"
                  onClick={() => update({ copilotOpen: !copilotOpen })}
                  aria-pressed={copilotOpen}
                >
                  {copilotOpen ? <PanelRightClose className="size-4" aria-hidden /> : <PanelRightOpen className="size-4" aria-hidden />}
                  Copilot
                </button>
                <Link to="/copilot" className="grid size-9 place-items-center rounded-lg bg-brand-700 text-white shadow-sm xl:hidden" aria-label="Open copilot">
                  <Bot className="size-5" />
                </Link>
                <button
                  className="grid size-9 place-items-center rounded-lg hover:bg-stone-100 lg:hidden"
                  aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                </button>
              </div>
            </div>
          </header>

          {/* Mobile drawer */}
          {menuOpen ? (
            <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
              <button className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
              <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-brand-gradient p-4">
                <div className="flex items-center justify-between">
                  <Brand inverted />
                  <button className="rounded-lg p-2 text-white hover:bg-white/10" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                    <X className="size-5" />
                  </button>
                </div>
                <SidebarNav onNavigate={() => setMenuOpen(false)} />
                <div className="rounded-xl bg-white p-3">
                  <DisplayCurrencySelect />
                </div>
                <ModeBadge mode={client.mode} />
              </div>
            </div>
          ) : null}

          <div className="flex flex-1 gap-6 px-4 pb-24 pt-6 lg:px-6 lg:pb-10">
            <main id="main" className={cn('mx-auto w-full min-w-0 max-w-6xl flex-1', onCopilotRoute && 'hidden')}>
              <AnimatePresence mode="wait" initial={false}>
                <PageTransition key={location.pathname} id={location.pathname}>
                  {outlet}
                </PageTransition>
              </AnimatePresence>
            </main>
            <aside
              aria-label="Copilot"
              className={cn(
                'no-print w-full shrink-0 xl:sticky xl:top-20 xl:h-[calc(100vh-7rem)] xl:w-[380px]',
                onCopilotRoute ? 'block' : copilotOpen ? 'hidden xl:block' : 'hidden',
              )}
            >
              <CopilotPanel />
            </aside>
          </div>
        </div>
      </div>

      <WelcomeTour />
      {/* Mobile bottom tabs */}
      <nav aria-label="Primary" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5">
          {MOBILE_TABS.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand-700' : 'text-stone-500')}
              >
                {({ isActive }) => (
                  <>
                    <span className="relative grid h-7 w-12 place-items-center">
                      {isActive ? <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-brand-50" transition={{ type: 'spring', stiffness: 420, damping: 34 }} /> : null}
                      <t.icon className="relative size-5" aria-hidden />
                    </span>
                    {t.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
