import type { ReactNode } from 'react';
import { AlertTriangle, Bot, FlaskConical, Info } from 'lucide-react';
import { MODE_LABEL, TRUTH_LABELS, type ExecutionMode, type MoneyMinor } from '@farmlink/engine';
import { Badge } from '@/components/ui/badge';
import { useMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * Money in the workspace currency. `approx` adds the viewer's display-currency equivalent
 * (reference rate, display only).
 */
export function Money({
  value,
  className,
  signed,
  approx,
  decimals,
}: {
  value: MoneyMinor;
  className?: string;
  signed?: boolean;
  approx?: 'inline' | 'below';
  decimals?: boolean;
}) {
  const { fmt, approx: toApprox } = useMoney();
  const negative = value.startsWith('-');
  const eq = approx ? toApprox(value) : null;
  const main = (
    <span className={cn('tabular whitespace-nowrap', negative && 'text-red-700')}>
      {signed && !negative && value !== '0' ? '+' : ''}
      {fmt(value, { decimals })}
    </span>
  );
  if (!eq) return <span className={className}>{main}</span>;
  return approx === 'below' ? (
    <span className={cn('inline-flex flex-col', className)}>
      {main}
      <span className="tabular text-xs font-normal text-stone-500" title="Approximate, at your reference rate (display only)">
        {eq}
      </span>
    </span>
  ) : (
    <span className={className}>
      {main}{' '}
      <span className="tabular text-xs font-normal text-stone-500" title="Approximate, at your reference rate (display only)">
        ({eq})
      </span>
    </span>
  );
}

export function ModeBadge({ mode, className }: { mode: ExecutionMode; className?: string }) {
  return mode === 'live_cloud' ? (
    <Badge variant="info" className={className}>
      <Bot aria-hidden /> {MODE_LABEL.live_cloud}
    </Badge>
  ) : (
    <Badge variant="neutral" className={className}>
      <FlaskConical aria-hidden /> {MODE_LABEL.guided_local}
    </Badge>
  );
}

export function TruthNote({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'warning'; className?: string }) {
  return (
    <p className={cn('flex items-start gap-2 text-xs leading-relaxed', tone === 'warning' ? 'text-amber-900' : 'text-stone-500', className)}>
      {tone === 'warning' ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
      <span>{children}</span>
    </p>
  );
}

export function SandboxBanner() {
  return (
    <div className="no-print bg-brand-950 px-4 py-1.5 text-center text-[11px] font-medium tracking-wide text-brand-100">
      <FlaskConical className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden />
      {TRUTH_LABELS.prototype}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-700">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-[28px]">{title}</h1>
        {description ? <div className="mt-1.5 max-w-3xl text-sm leading-relaxed text-stone-600">{description}</div> : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

const TONE = {
  danger: { ring: 'ring-red-200', icon: 'bg-red-50 text-red-700' },
  warning: { ring: 'ring-amber-200', icon: 'bg-amber-50 text-amber-700' },
  ok: { ring: 'ring-emerald-200', icon: 'bg-emerald-50 text-emerald-700' },
  neutral: { ring: 'ring-stone-200', icon: 'bg-stone-100 text-stone-600' },
} as const;

export function Stat({
  label,
  children,
  hint,
  tone = 'neutral',
  icon: Icon,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof TONE;
  icon?: typeof Info;
}) {
  const t = TONE[tone];
  return (
    <div className={cn('rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] ring-1', t.ring)}>
      <div className="flex items-center gap-2">
        {Icon ? (
          <span className={cn('grid size-7 place-items-center rounded-lg', t.icon)}>
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
        <div className="text-xs font-medium text-stone-500">{label}</div>
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-stone-900">{children}</div>
      {hint ? <div className="mt-1 text-xs text-stone-500">{hint}</div> : null}
    </div>
  );
}

export function EmptyState({ title, children, action, icon: Icon = Info }: { title: string; children?: ReactNode; action?: ReactNode; icon?: typeof Info }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 bg-white/70 px-6 py-14 text-center">
      <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <Icon className="size-6" aria-hidden />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      {children ? <div className="max-w-md text-sm text-stone-600">{children}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

const STATUS_TONE: Record<string, 'default' | 'neutral' | 'warning' | 'danger' | 'info' | 'success'> = {
  fits: 'success',
  does_not_fit: 'danger',
  needs_information: 'warning',
  DRAFT: 'neutral',
  AWAITING_CONFIRMATION: 'warning',
  SANDBOX_SUBMITTED: 'success',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
  allowed: 'success',
  rejected: 'danger',
  requires_confirmation: 'warning',
  error: 'danger',
  planned: 'info',
  settled: 'success',
  cancelled: 'neutral',
  pending: 'warning',
  consumed: 'success',
  expired: 'neutral',
  completed: 'success',
  awaiting_confirmation: 'warning',
  failed: 'danger',
  limit_reached: 'warning',
  resilient: 'success',
  partly_resilient: 'warning',
  fragile: 'danger',
};

const STATUS_TEXT: Record<string, string> = {
  fits: 'Fits stated sandbox rules',
  does_not_fit: 'Does not fit',
  needs_information: 'Needs information',
  DRAFT: 'Draft',
  AWAITING_CONFIRMATION: 'Awaiting your confirmation',
  SANDBOX_SUBMITTED: 'Sandbox submitted',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  requires_confirmation: 'Needs human confirmation',
  awaiting_confirmation: 'Awaiting confirmation',
  limit_reached: 'Limit reached',
  resilient: 'Resilient',
  partly_resilient: 'Partly resilient',
  fragile: 'Fragile under stress',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={STATUS_TONE[status] ?? 'neutral'} className={className}>
      {STATUS_TEXT[status] ?? status.replace(/_/g, ' ')}
    </Badge>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">{children}</h2>
      {action}
    </div>
  );
}
