import { useState } from 'react';
import { Bot, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CloudSandboxClient, fetchHealth } from '@/services/cloud/CloudSandboxClient';
import { useSandbox } from '@/state/SandboxProvider';
import { config, liveModeConfigured } from '@/lib/config';
import { errorMessage } from '@/lib/utils';

/**
 * One-click opt-in to the live AI agent. Starts a fresh, empty cloud session; local data is
 * not uploaded (copying requires the explicit checkbox on the Business profile page).
 */
export function GoLiveCard() {
  const { client, setClient } = useSandbox();
  const [state, setState] = useState<'idle' | 'waking' | 'connecting'>('idle');
  if (!liveModeConfigured || client.mode === 'live_cloud') return null;

  const go = async () => {
    try {
      setState('waking');
      const h = await fetchHealth(config.apiBaseUrl);
      if (!h.aiAvailable) {
        toast.error('The live API is up, but model calls are disabled right now. Guided mode still works.');
        setState('idle');
        return;
      }
      setState('connecting');
      const cloud = await CloudSandboxClient.connect(config.apiBaseUrl, { fresh: true });
      await setClient(cloud);
      toast.success(`Live AI connected (${h.provider?.modelId}). Load the demo to start chatting.`);
    } catch (e) {
      toast.error(`Could not reach the live API: ${errorMessage(e)}`);
    } finally {
      setState('idle');
    }
  };

  return (
    <div className="mb-4 rounded-2xl bg-gradient-to-br from-sky-50 to-brand-50 p-3 ring-1 ring-sky-200">
      <div className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white text-sky-700 shadow-sm">
          <Bot className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-semibold">Live AI agent available</div>
          <p className="text-xs leading-relaxed text-stone-600">
            Chat with a Gemini agent that calls the same audited tools. It starts a fresh sandbox session; your local data is not uploaded.
          </p>
        </div>
      </div>
      <Button size="sm" className="mt-3 w-full" onClick={go} disabled={state !== 'idle'}>
        {state === 'idle' ? (
          <>
            <Zap aria-hidden /> Switch to live AI
          </>
        ) : (
          <>
            <Loader2 className="animate-spin" aria-hidden /> {state === 'waking' ? 'Waking the server (up to ~50 s)…' : 'Starting session…'}
          </>
        )}
      </Button>
    </div>
  );
}
