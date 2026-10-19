import { useState } from 'react';
import { Bot, PlugZap } from 'lucide-react';
import { TRUTH_LABELS } from '@farmlink/engine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { TruthNote } from '@/components/common';
import { CloudSandboxClient, fetchHealth, type HealthInfo } from '@/services/cloud/CloudSandboxClient';
import { useSandbox } from '@/state/SandboxProvider';
import { config, liveModeConfigured } from '@/lib/config';
import { errorMessage } from '@/lib/utils';
import { toast } from 'sonner';

export function LiveModeCard() {
  const { client, snapshot, setClient, switchToLocal } = useSandbox();
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyLocal, setCopyLocal] = useState(false);
  const [connecting, setConnecting] = useState(false);

  if (!liveModeConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="size-4" aria-hidden /> Live AI mode
          </CardTitle>
          <CardDescription>This build has no live API configured, so only the guided sandbox is available. Guided mode is not a live AI agent.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (client.mode === 'live_cloud') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="size-4" aria-hidden /> Live AI + sandbox tools
          </CardTitle>
          <CardDescription>Connected to {config.apiBaseUrl}. Records in this mode are stored by the sandbox API for this session only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <TruthNote>{TRUTH_LABELS.serverLogs}</TruthNote>
          <Button variant="outline" onClick={() => void switchToLocal()}>
            Switch to guided sandbox (local data)
          </Button>
        </CardContent>
      </Card>
    );
  }

  const check = async () => {
    setChecking(true);
    setError(null);
    try {
      setHealth(await fetchHealth(config.apiBaseUrl));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setChecking(false);
    }
  };

  const connect = async () => {
    setConnecting(true);
    try {
      const cloud = await CloudSandboxClient.connect(config.apiBaseUrl, { fresh: true });
      if (copyLocal && snapshot?.workspace) {
        await cloud.importBundle({ workspace: snapshot.workspace, events: snapshot.events, catalog: snapshot.catalog, catalogVersion: snapshot.catalogVersion });
      }
      await setClient(cloud);
      toast.success('Live session started.');
    } catch (e) {
      toast.error(`Could not start live session: ${errorMessage(e)}`);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlugZap className="size-4" aria-hidden /> Live AI mode (opt in)
        </CardTitle>
        <CardDescription>
          Uses a separate sandbox API where a tool-calling model proposes actions and server code validates and executes them. No API key is ever in this page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Button variant="outline" onClick={check} disabled={checking}>
          {checking ? 'Checking (free hosting may take ~50 s to wake)…' : 'Check live API availability'}
        </Button>
        {error ? <Alert variant="danger">{error}</Alert> : null}
        {health ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={health.status === 'ok' ? 'success' : 'danger'}>API {health.status}</Badge>
              <Badge variant={health.aiAvailable ? 'success' : 'warning'}>{health.aiAvailable ? `Model configured: ${health.provider?.modelId}` : 'Model calls disabled'}</Badge>
            </div>
            {!health.aiAvailable ? (
              <TruthNote tone="warning">Live model calls are disabled on the server right now. An availability check is not a successful model call.</TruthNote>
            ) : null}
            <Alert variant="neutral">
              <div>
                A <strong>fresh, empty cloud session</strong> will be created. Local records are not uploaded unless you tick the box below.
              </div>
            </Alert>
            {snapshot?.workspace ? (
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={copyLocal} onChange={(e) => setCopyLocal(e.target.checked)} />
                <span>
                  Copy my local workspace to the cloud session: business profile, {snapshot.events.length} cash record(s), and {snapshot.catalog.length} catalog product(s). Drafts,
                  receipts, and logs are not copied.
                </span>
              </label>
            ) : null}
            <Button onClick={connect} disabled={connecting || health.status !== 'ok'}>
              {connecting ? 'Starting…' : 'Start live session'}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
