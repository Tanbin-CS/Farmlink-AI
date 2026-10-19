import { useCallback } from 'react';
import { convertMinor, formatMoney, isValidRate, type CurrencyCode, type MoneyMinor } from '@farmlink/engine';
import { useSandbox } from '@/state/SandboxProvider';
import { usePreferences } from '@/state/PreferencesProvider';

/** Formats money in the workspace currency, plus an optional approximate display equivalent. */
export function useMoney() {
  const { snapshot } = useSandbox();
  const { prefs } = usePreferences();
  const currency: CurrencyCode = snapshot?.workspace?.currency ?? 'BDT';
  const fmt = useCallback(
    (v: MoneyMinor, opts: { decimals?: boolean; symbol?: boolean } = {}) =>
      formatMoney(v, currency, { grouping: prefs.grouping, decimals: opts.decimals, withSymbol: opts.symbol }),
    [currency, prefs.grouping],
  );
  const target = prefs.displayCurrency;
  const approx = useCallback(
    (v: MoneyMinor): string | null => {
      if (target === 'none' || target === currency) return null;
      const rateOk = (c: CurrencyCode) => c === 'BDT' || isValidRate(prefs.rates[c]);
      if (!rateOk(target) || !rateOk(currency)) return null;
      return `≈ ${formatMoney(convertMinor(v, currency, target, prefs.rates), target, { grouping: 'international', decimals: false })}`;
    },
    [currency, target, prefs.rates],
  );
  return { currency, fmt, approx };
}
