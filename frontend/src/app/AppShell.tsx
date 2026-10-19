import { useState, type ReactNode } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Activity, BarChart3, FileText, Home, Info, Landmark, ListChecks, Menu, MessageSquare, Sprout, X } from 'lucide-react';
import { useSandbox } from '@/state/SandboxProvider';
import { ModeBadge, SandboxBanner } from '@/components/common';
import { CopilotPanel } from '@/features/copilot/CopilotPanel';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/workspace', label: 'Overview', icon: Home },
  { to: '/records', label: 'Records', icon: ListChecks },
  { to: '/cashflow', label: 'Cash flow', icon: BarChart3 },
  { to: '/financing', label: 'Financing', icon: Landmark },
  { to: '/applications', label: 'Applications', icon: FileText },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/about', label: 'About & limits', icon: Info },
];

export function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold text-brand-900">
      <span className="grid size-8 place-items-center rounded-lg bg-brand-900 text-brand-100">
        <Sprout className="size-5" aria-hidden />
      </span>
      <span className="text-base tracking-tight">FarmLink AI</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { client } = useSandbox();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const onCopilotRoute = location.pathname === '/copilot';

  return (
    <div className="flex min-h-screen flex-col">
      <SandboxBanner />
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4">
          <Brand />
          <ModeBadge mode={client.mode} className="hidden sm:inline-flex" />
          <nav aria-label="Workspace" className="ml-auto hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn('rounded-md px-2.5 py-1.5 text-sm text-stone-700 hover:bg-stone-100', isActive && 'bg-brand-50 font-medium text-brand-900')
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 lg:hidden">
            <Link to="/copilot" className="rounded-md p-2 hover:bg-stone-100" aria-label="Open copilot">
              <MessageSquare className="size-5" />
            </Link>
            <button className="rounded-md p-2 hover:bg-stone-100" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {open ? (
          <nav aria-label="Workspace mobile" className="border-t border-stone-200 bg-white px-4 py-2 lg:hidden">
            <ModeBadge mode={client.mode} className="mb-2 sm:hidden" />
            <ul className="grid grid-cols-2 gap-1">
              {NAV.map((n) => (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) => cn('flex items-center gap-2 rounded-md px-2 py-2 text-sm', isActive ? 'bg-brand-50 text-brand-900' : 'hover:bg-stone-100')}
                  >
                    <n.icon className="size-4" aria-hidden /> {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 gap-6 px-4 py-6">
        <main id="main" className={cn('min-w-0 flex-1', onCopilotRoute && 'hidden')}>
          {children}
        </main>
        <aside
          aria-label="Copilot"
          className={cn(
            'w-full shrink-0 lg:sticky lg:top-20 lg:block lg:h-[calc(100vh-6.5rem)] lg:w-[380px]',
            onCopilotRoute ? 'block' : 'hidden',
          )}
        >
          <CopilotPanel />
        </aside>
      </div>
    </div>
  );
}
