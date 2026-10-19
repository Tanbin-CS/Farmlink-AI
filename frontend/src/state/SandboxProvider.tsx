import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { compareFinancing, projectCashflow, type CashflowResult, type FinancingComparison } from '@farmlink/engine';
import { LocalSandboxClient } from '@/services/local/LocalSandboxClient';
import type { SandboxClient, SandboxSnapshot } from '@/services/types';
import { errorMessage } from '@/lib/utils';

interface SandboxContextValue {
  client: SandboxClient;
  snapshot: SandboxSnapshot | null;
  loading: boolean;
  busy: boolean;
  /** Derived, deterministic views of the current records (same engine as the API). */
  cashflow: CashflowResult | null;
  comparison: FinancingComparison | null;
  derivedError: string | null;
  refresh: () => Promise<void>;
  run: <T>(label: string, fn: (c: SandboxClient) => Promise<T>, opts?: { success?: string | ((r: T) => string); silent?: boolean }) => Promise<T | undefined>;
  setClient: (client: SandboxClient) => Promise<void>;
  switchToLocal: () => Promise<void>;
}

const SandboxContext = createContext<SandboxContextValue | null>(null);

export function SandboxProvider({ children, initialClient }: { children: ReactNode; initialClient?: SandboxClient }) {
  const localRef = useRef<SandboxClient>(initialClient ?? new LocalSandboxClient());
  const [client, setClientState] = useState<SandboxClient>(localRef.current);
  const [snapshot, setSnapshot] = useState<SandboxSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refreshWith = useCallback(async (c: SandboxClient) => {
    const s = await c.load();
    setSnapshot(s);
  }, []);

  useEffect(() => {
    let cancelled = false;
    client
      .load()
      .then((s) => {
        if (!cancelled) setSnapshot(s);
      })
      .catch((e) => toast.error(`Could not load workspace: ${errorMessage(e)}`))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const refresh = useCallback(() => refreshWith(client), [client, refreshWith]);

  const run = useCallback<SandboxContextValue['run']>(
    async (label, fn, opts) => {
      setBusy(true);
      try {
        const r = await fn(client);
        await refreshWith(client);
        if (opts?.success) toast.success(typeof opts.success === 'function' ? opts.success(r) : opts.success);
        return r;
      } catch (e) {
        if (!opts?.silent) toast.error(`${label}: ${errorMessage(e)}`);
        await refreshWith(client).catch(() => undefined);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [client, refreshWith],
  );

  const setClient = useCallback(async (c: SandboxClient) => {
    setLoading(true);
    setClientState(c);
  }, []);

  const switchToLocal = useCallback(async () => {
    setLoading(true);
    setClientState(localRef.current);
  }, []);

  const derived = useMemo(() => {
    if (!snapshot?.workspace) return { cashflow: null, comparison: null, derivedError: null };
    try {
      const cashflow = projectCashflow(snapshot.workspace, snapshot.events);
      const comparison = compareFinancing(snapshot.workspace, snapshot.events, snapshot.catalog, snapshot.catalogVersion, cashflow);
      return { cashflow, comparison, derivedError: null };
    } catch (e) {
      return { cashflow: null, comparison: null, derivedError: errorMessage(e) };
    }
  }, [snapshot]);

  const value: SandboxContextValue = { client, snapshot, loading, busy, ...derived, refresh, run, setClient, switchToLocal };
  return <SandboxContext.Provider value={value}>{children}</SandboxContext.Provider>;
}

export function useSandbox(): SandboxContextValue {
  const ctx = useContext(SandboxContext);
  if (!ctx) throw new Error('useSandbox must be used inside SandboxProvider');
  return ctx;
}
