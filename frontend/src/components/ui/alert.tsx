import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva('relative flex gap-3 rounded-lg border p-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0', {
  variants: {
    variant: {
      info: 'border-sky-200 bg-sky-50 text-sky-950',
      warning: 'border-amber-300 bg-amber-50 text-amber-950',
      danger: 'border-red-300 bg-red-50 text-red-950',
      success: 'border-emerald-300 bg-emerald-50 text-emerald-950',
      neutral: 'border-stone-200 bg-stone-50 text-stone-800',
    },
  },
  defaultVariants: { variant: 'info' },
});

export function Alert({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return <div role="status" className={cn(alertVariants({ variant }), className)} {...props} />;
}
