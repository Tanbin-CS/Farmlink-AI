import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand-700 text-white shadow-sm hover:bg-brand-800',
        secondary: 'bg-brand-50 text-brand-900 hover:bg-brand-100 border border-brand-200',
        outline: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 hover:border-stone-400',
        ghost: 'hover:bg-stone-100',
        destructive: 'bg-red-700 text-white hover:bg-red-800',
        link: 'text-brand-700 underline-offset-4 hover:underline',
        harvest: 'bg-harvest-400 text-stone-950 shadow-sm hover:bg-harvest-500',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = 'button', ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size, className }))} {...props} />
));
Button.displayName = 'Button';

export { buttonVariants };
