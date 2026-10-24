import { Coins } from 'lucide-react';
import type { CurrencyCode } from '@farmlink/engine';
import { usePreferences } from '@/state/PreferencesProvider';
import { useSandbox } from '@/state/SandboxProvider';
import { cn } from '@/lib/utils';

/** Quick switch for the approximate secondary currency shown next to amounts. */
export function DisplayCurrencySelect({ className }: { className?: string }) {
  const { prefs, update } = usePreferences();
  const { snapshot } = useSandbox();
  const base = snapshot?.workspace?.currency ?? 'BDT';
  const options = (['USD', 'EUR', 'CNY', 'BDT'] as CurrencyCode[]).filter((c) => c !== base);
  return (
    <label className={cn('flex items-center gap-1.5 text-xs text-stone-600', className)} title={`Your workspace amounts are in ${base}. Pick a second currency to show approximate equivalents (display only).`}>
      <Coins className="size-4 text-stone-400" aria-hidden />
      <span className="whitespace-nowrap">
        Amounts in <strong className="font-semibold text-stone-800">{base}</strong> · also show
      </span>
      <select
        className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-xs font-medium text-stone-800 hover:border-stone-300"
        value={prefs.displayCurrency === base ? 'none' : prefs.displayCurrency}
        onChange={(e) => update({ displayCurrency: e.target.value as CurrencyCode | 'none' })}
        aria-label="Approximate display currency"
      >
        {options.map((c) => (
          <option key={c} value={c}>
            ≈ {c}
          </option>
        ))}
        <option value="none">nothing</option>
      </select>
    </label>
  );
}
