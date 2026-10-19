import type { ReactNode } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Plain-language glossary for finance terms, shown on hover or keyboard focus. */
export const GLOSSARY = {
  fundingGap: 'The deepest point your cash falls below zero in the forecast. This is the net cash you would need to stay at zero or above.',
  lowestPoint: 'The smallest projected closing balance in the window, and the date it happens.',
  buffer: 'A safety cushion you choose. Days below it raise a "low cash" alert; "Gap + buffer" borrows enough to keep it.',
  netCash: 'Principal minus the upfront fee. This is the cash that actually reaches you.',
  totalCost: 'Upfront fee plus simple interest for the term. Used to rank options that fit.',
  fits: 'Fits the stated sandbox rules: eligible, funds arrive in time, and cash stays at or above zero through repayment. It is not an approval.',
  stress: 'Keeps the loan fixed and replays your plan with a late harvest, lower sales, higher costs, and a combined shock.',
  payloadHash: 'A SHA-256 fingerprint of exactly what you reviewed. Any change afterwards cancels the confirmation.',
  openingCash: 'Cash available at the start of the as-of date. Earlier settled payments are already included.',
  whatIf: 'Your own assumptions applied to planned records. Your saved records never change.',
} as const;

export function Term({ children, tip, className, icon = true }: { children: ReactNode; tip: string; className?: string; icon?: boolean }) {
  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>
        <button type="button" className={cn('inline-flex items-center gap-1 rounded text-left decoration-dotted underline-offset-4 hover:underline', className)}>
          {children}
          {icon ? <HelpCircle className="size-3.5 shrink-0 text-stone-400" aria-hidden /> : null}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={6}
          collisionPadding={12}
          className="z-[60] max-w-72 rounded-xl bg-stone-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg data-[state=delayed-open]:animate-[fadeIn_120ms_ease-out]"
        >
          {tip}
          <Tooltip.Arrow className="fill-stone-900" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export const TooltipProvider = Tooltip.Provider;
