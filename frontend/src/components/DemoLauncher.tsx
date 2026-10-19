import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import type { CurrencyCode } from '@farmlink/engine';
import { Button } from '@/components/ui/button';
import { useSandbox } from '@/state/SandboxProvider';
import { cn } from '@/lib/utils';

/** One-click fictional demo scenario, in the currency the viewer prefers to read. */
export function DemoLauncher({ size = 'default', navigateTo, className, label = 'Load sandbox demo scenario' }: { size?: 'default' | 'lg' | 'sm'; navigateTo?: string; className?: string; label?: string }) {
  const { run, busy } = useSandbox();
  const navigate = useNavigate();
  const [currency, setCurrency] = useState<CurrencyCode>('BDT');
  const start = async () => {
    const r = await run('Load demo', (c) => c.loadDemo(currency), { success: `Fictional demo loaded in ${currency}.` });
    if (r && navigateTo) navigate(navigateTo);
  };
  return (
    <div className={cn('inline-flex flex-wrap items-center gap-2', className)}>
      <Button size={size} onClick={start} disabled={busy}>
        <Play aria-hidden /> {label}
      </Button>
      <div role="radiogroup" aria-label="Demo currency" className="inline-flex rounded-lg bg-stone-100 p-0.5 text-xs font-semibold">
        {(['BDT', 'USD', 'EUR'] as CurrencyCode[]).map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={currency === c}
            onClick={() => setCurrency(c)}
            className={cn('rounded-md px-2.5 py-1.5', currency === c ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800')}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
