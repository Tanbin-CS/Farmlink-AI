import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/common';
import { DemoLauncher } from '@/components/DemoLauncher';
import { useSandbox } from '@/state/SandboxProvider';

export function RequireWorkspace({ children }: { children: ReactNode }) {
  const { snapshot, loading } = useSandbox();
  if (loading) return <div className="h-64 animate-pulse rounded-3xl bg-white/70" aria-label="Loading workspace" />;
  if (!snapshot?.workspace) {
    return (
      <EmptyState
        title="Start with a workspace"
        icon={Sprout}
        action={
          <div className="flex flex-col items-center gap-3">
            <DemoLauncher />
            <Link to="/setup" className={buttonVariants({ variant: 'link' })}>
              or set up your own business
            </Link>
          </div>
        }
      >
        Explore the fictional demo cooperative, which runs out of cash before harvest, or enter your own business. Nothing is pre-filled with invented balances.
      </EmptyState>
    );
  }
  return <>{children}</>;
}
