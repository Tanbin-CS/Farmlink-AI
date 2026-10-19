import { useEffect, useMemo, useState } from 'react';
import { useSandbox } from '@/state/SandboxProvider';

const VISIT_KEY = 'farmlink.visited.v1';
const listeners = new Set<() => void>();

function readVisited(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(VISIT_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

/** Marks a journey page as seen (per browser; a convenience only). */
export function useMarkVisited(path: string, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const v = readVisited();
    if (v.has(path)) return;
    v.add(path);
    try {
      localStorage.setItem(VISIT_KEY, JSON.stringify([...v]));
    } catch {
      // ignore
    }
    listeners.forEach((l) => l());
  }, [path, enabled]);
}

export interface JourneyStep {
  id: string;
  n: number;
  label: string;
  short: string;
  to: string;
  done: boolean;
  hint: string;
}

export function useJourney() {
  const { snapshot } = useSandbox();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return useMemo(() => {
    void tick;
    const visited = readVisited();
    const tools = new Set(snapshot?.toolEvents.map((e) => e.tool) ?? []);
    const hasWs = !!snapshot?.workspace;
    const hasEvents = (snapshot?.events.length ?? 0) > 0;
    const hasApp = (snapshot?.applications.length ?? 0) > 0;
    const submitted = snapshot?.applications.some((a) => a.status === 'SANDBOX_SUBMITTED') ?? false;
    const steps: JourneyStep[] = [
      { id: 'profile', n: 1, label: 'Business profile', short: 'Profile', to: '/setup', done: hasWs, hint: 'Describe the business and opening cash.' },
      { id: 'records', n: 2, label: 'Cash records', short: 'Records', to: '/records', done: hasWs && hasEvents, hint: 'Add expected sales and costs.' },
      {
        id: 'forecast',
        n: 3,
        label: 'Cash-flow forecast',
        short: 'Forecast',
        to: '/cashflow',
        done: hasEvents && (tools.has('calculate_cashflow') || visited.has('/cashflow')),
        hint: 'See when cash runs short and by how much.',
      },
      {
        id: 'financing',
        n: 4,
        label: 'Financing options',
        short: 'Financing',
        to: '/financing',
        done: hasEvents && (tools.has('match_financing_options') || visited.has('/financing') || hasApp),
        hint: 'Compare options that cover the gap in time.',
      },
      { id: 'apply', n: 5, label: 'Apply (sandbox)', short: 'Apply', to: '/applications', done: submitted, hint: 'Review and confirm the exact application.' },
    ];
    const next = steps.find((s) => !s.done) ?? null;
    const completed = steps.filter((s) => s.done).length;
    return { steps, next, completed, total: steps.length };
  }, [snapshot, tick]);
}
