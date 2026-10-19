import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_REFERENCE_RATES, type CurrencyCode, type DigitGrouping, type ReferenceRates } from '@farmlink/engine';

/** Per-viewer display preferences. They never change stored records or calculations. */
export interface Preferences {
  /** Secondary currency shown as an approximate equivalent ("none" hides it). */
  displayCurrency: CurrencyCode | 'none';
  rates: ReferenceRates;
  grouping: DigitGrouping;
  copilotOpen: boolean;
}

const KEY = 'farmlink.prefs.v1';
const DEFAULTS: Preferences = { displayCurrency: 'USD', rates: DEFAULT_REFERENCE_RATES, grouping: 'international', copilotOpen: true };

function load(): Preferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<Preferences>;
    return { ...DEFAULTS, ...p, rates: { ...DEFAULTS.rates, ...(p.rates ?? {}) } };
  } catch {
    return DEFAULTS;
  }
}

interface Ctx {
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
  resetRates: () => void;
}

const PrefsContext = createContext<Ctx | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(load);
  const update = useCallback((patch: Partial<Preferences>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // storage unavailable: keep in memory
      }
      return next;
    });
  }, []);
  const resetRates = useCallback(() => update({ rates: DEFAULT_REFERENCE_RATES }), [update]);
  const value = useMemo(() => ({ prefs, update, resetRates }), [prefs, update, resetRates]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePreferences(): Ctx {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
