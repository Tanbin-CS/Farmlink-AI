import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Activity,
  BarChart3,
  Bot,
  Building2,
  Coins,
  FileText,
  Home,
  Info,
  Landmark,
  ListChecks,
  PlusCircle,
  Search,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { CurrencyCode } from '@farmlink/engine';
import { useSandbox } from '@/state/SandboxProvider';
import { usePreferences } from '@/state/PreferencesProvider';
import { pauseSmoothScroll } from './SmoothScroll';
import { cn } from '@/lib/utils';

const listeners = new Set<(open: boolean) => void>();

export function openCommandPalette() {
  listeners.forEach((l) => l(true));
}

function Item({ icon: Icon, children, onSelect, shortcut }: { icon: typeof Home; children: React.ReactNode; onSelect: () => void; shortcut?: string }) {
  return (
    <Command.Item onSelect={onSelect} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-stone-700">
      <Icon className="size-4 text-stone-400" aria-hidden />
      <span className="flex-1">{children}</span>
      {shortcut ? <kbd className="rounded-md border border-stone-200 bg-stone-50 px-1.5 text-[10px] font-medium text-stone-500">{shortcut}</kbd> : null}
    </Command.Item>
  );
}

/** Keyboard-first navigation and quick actions (Ctrl/⌘ + K). */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { run, snapshot } = useSandbox();
  const { prefs, update } = usePreferences();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const l = (v: boolean) => setOpen(v);
    listeners.add(l);
    window.addEventListener('keydown', onKey);
    return () => {
      listeners.delete(l);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    pauseSmoothScroll(true);
    return () => pauseSmoothScroll(false);
  }, [open]);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };
  const demo = async (c: CurrencyCode) => {
    setOpen(false);
    const r = await run('Load demo', (cl) => cl.loadDemo(c), { success: `Fictional demo loaded in ${c}.` });
    if (r) navigate('/workspace');
  };
  const hasWs = !!snapshot?.workspace;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-[2px] data-[state=open]:animate-[fadeIn_140ms_ease-out]" />
        <DialogPrimitive.Content
          data-lenis-prevent
          aria-describedby={undefined}
          className="fixed left-1/2 top-[14vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-stone-200 data-[state=open]:animate-[fadeIn_160ms_ease-out]"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <Command label="Command palette" loop>
            <div className="flex items-center gap-2 border-b border-stone-100 px-4">
              <Search className="size-4 text-stone-400" aria-hidden />
              <Command.Input autoFocus placeholder="Where do you want to go? Try “forecast” or “demo”…" className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400 focus-visible:outline-none" />
              <kbd className="rounded-md border border-stone-200 px-1.5 text-[10px] text-stone-500">Esc</kbd>
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-center text-sm text-stone-500">No matches. Try “records”, “financing”, or “demo”.</Command.Empty>
              <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-stone-400">
                <Item icon={Home} onSelect={() => go('/workspace')}>
                  Overview dashboard
                </Item>
                <Item icon={Building2} onSelect={() => go('/setup')}>
                  Business profile and settings
                </Item>
                <Item icon={ListChecks} onSelect={() => go('/records')}>
                  Cash records
                </Item>
                <Item icon={BarChart3} onSelect={() => go('/cashflow')}>
                  Cash-flow forecast and what-if
                </Item>
                <Item icon={Landmark} onSelect={() => go('/financing')}>
                  Financing options and stress test
                </Item>
                <Item icon={FileText} onSelect={() => go('/applications')}>
                  Applications
                </Item>
                <Item icon={Activity} onSelect={() => go('/activity')}>
                  Activity and evidence export
                </Item>
                <Item icon={Info} onSelect={() => go('/about')}>
                  About, limits, and privacy
                </Item>
              </Command.Group>
              <Command.Group heading="Actions" className="mt-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-stone-400">
                {(['BDT', 'USD', 'EUR'] as CurrencyCode[]).map((c) => (
                  <Item key={c} icon={Sparkles} onSelect={() => void demo(c)}>
                    Load fictional demo in {c}
                  </Item>
                ))}
                {hasWs ? (
                  <Item icon={PlusCircle} onSelect={() => go('/records?new=1')}>
                    Add a cash record
                  </Item>
                ) : null}
                {hasWs ? (
                  <Item icon={Wand2} onSelect={() => go('/cashflow')}>
                    Try a what-if scenario
                  </Item>
                ) : null}
                <Item icon={Bot} onSelect={() => (setOpen(false), update({ copilotOpen: !prefs.copilotOpen }))}>
                  {prefs.copilotOpen ? 'Hide' : 'Show'} copilot panel
                </Item>
                {(['USD', 'EUR', 'none'] as const).map((c) => (
                  <Item key={c} icon={Coins} onSelect={() => (setOpen(false), update({ displayCurrency: c }))}>
                    {c === 'none' ? 'Hide approximate equivalents' : `Show approximate ${c} equivalents`}
                  </Item>
                ))}
              </Command.Group>
            </Command.List>
            <div className="flex items-center justify-between border-t border-stone-100 px-4 py-2 text-[11px] text-stone-400">
              <span>↑↓ to move · Enter to select</span>
              <span>Ctrl / ⌘ K</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function CommandButton({ className }: { className?: string }) {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return (
    <button
      onClick={openCommandPalette}
      className={cn('flex h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-500 shadow-xs transition-colors hover:border-stone-300 hover:text-stone-700', className)}
      aria-label="Open command palette"
    >
      <Search className="size-4" aria-hidden />
      <span className="hidden md:inline">Jump to…</span>
      <kbd className="hidden rounded-md border border-stone-200 bg-stone-50 px-1.5 text-[10px] font-medium md:inline">{mac ? '⌘' : 'Ctrl'} K</kbd>
    </button>
  );
}
