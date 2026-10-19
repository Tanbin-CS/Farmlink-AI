import type { ReactNode } from 'react';
import { AlertTriangle, Bot, FlaskConical, Info } from 'lucide-react';
import { formatBDT, MODE_LABEL, TRUTH_LABELS, type ExecutionMode, type MoneyMinor } from '@farmlink/engine';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function Money({ value, className, signed }: { value: MoneyMinor; className?: string; signed?: boolean }) {
  const negative = value.startsWith('-');
  return (
    <span className={cn('tabular whitespace-nowrap', negative && 'text-red-700', className)}>
      {signed && !negative && value !== '0' ? '+' : ''}
      {formatBDT(value)}
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

export function TruthNote({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warning' }) {
  return (
    <p className={cn('flex items-start gap-2 text-xs', tone === 'warning' ? 'text-amber-900' : 'text-stone-600')}>
      {tone === 'warning' ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
      <span>{children}</span>
    </p>
  );
}

export function SandboxBanner() {
  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-950">
      {TRUTH_LABELS.prototype}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">{title}</h1>
        {description ? <div className="mt-1 max-w-3xl text-sm text-stone-600">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Stat({ label, children, hint, tone }: { label: string; children: ReactNode; hint?: ReactNode; tone?: 'danger' | 'warning' | 'ok' }) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-4',
        tone === 'danger' ? 'border-red-200' : tone === 'warning' ? 'border-amber-200' : tone === 'ok' ? 'border-emerald-200' : 'border-stone-200',
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-stone-900">{children}</div>
      {hint ? <div className="mt-0.5 text-xs text-stone-600">{hint}</div> : null}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      {children ? <div className="max-w-md text-sm text-stone-600">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
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
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_TONE[status] ?? 'neutral'}>{STATUS_TEXT[status] ?? status.replace(/_/g, ' ')}</Badge>;
}
