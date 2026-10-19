import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium [&_svg]:size-3', {
  variants: {
    variant: {
      default: 'border-brand-200 bg-brand-50 text-brand-900',
      neutral: 'border-stone-200 bg-stone-100 text-stone-700',
      warning: 'border-amber-300 bg-amber-50 text-amber-900',
      danger: 'border-red-300 bg-red-50 text-red-900',
      info: 'border-sky-300 bg-sky-50 text-sky-900',
      success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
