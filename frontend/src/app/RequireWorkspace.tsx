import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/common';
import { useSandbox } from '@/state/SandboxProvider';

export function RequireWorkspace({ children }: { children: ReactNode }) {
  const { snapshot, loading, run } = useSandbox();
  if (loading) return <p className="text-sm text-stone-600">Loading workspace…</p>;
  if (!snapshot?.workspace) {
    return (
      <EmptyState
        title="No workspace yet"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => run('Load demo', (c) => c.loadDemo(), { success: 'Sandbox demo scenario loaded.' })}>Load sandbox demo scenario</Button>
            <Link to="/setup" className={buttonVariants({ variant: 'outline' })}>
              Set up my own
            </Link>
          </div>
        }
      >
        Load the fictional demo cooperative or enter your own business profile. Nothing is pre-filled with invented balances.
      </EmptyState>
    );
  }
  return <>{children}</>;
}
