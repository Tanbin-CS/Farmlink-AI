import { useState } from 'react';
import { Download } from 'lucide-react';
import { TRUTH_LABELS } from '@farmlink/engine';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { EmptyState, ModeBadge, PageHeader, StatusBadge, TruthNote } from '@/components/common';
import { useSandbox } from '@/state/SandboxProvider';
import { downloadText } from '@/lib/utils';

export function ActivityPage() {
  const { snapshot, client, run, busy } = useSandbox();
  const [redact, setRedact] = useState(false);
  const events = [...(snapshot?.toolEvents ?? [])].reverse();

  const exportBundle = async () => {
    const b = await run('Export evidence', (c) => c.exportEvidence(redact), { success: 'Evidence bundle downloaded.' });
    if (b) downloadText(`farmlink-evidence-${b.mode}-${b.generatedAt.replace(/[:.]/g, '-')}.json`, JSON.stringify(b, null, 2));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Activity and evidence"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            Actual action and tool events, including policy decisions and rejections. Mode: <ModeBadge mode={client.mode} />
          </span>
        }
        actions={
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={redact} onChange={(e) => setRedact(e.target.checked)} /> Redact business name
            </label>
            <Button onClick={exportBundle} disabled={busy || !snapshot?.workspace}>
              <Download aria-hidden /> Export evidence bundle
            </Button>
          </>
        }
      />
      {snapshot?.runs.length ? (
        <Card>
          <Table>
            <caption className="px-3 py-2 text-left text-sm font-semibold">Agent runs</caption>
            <THead>
              <tr>
                <TH>Started (UTC)</TH>
                <TH>Run</TH>
                <TH>Status</TH>
                <TH>Model</TH>
                <TH>Round trips / tool calls</TH>
                <TH>Request</TH>
              </tr>
            </THead>
            <TBody>
              {[...snapshot.runs].reverse().map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap font-mono text-xs">{r.startedAt}</TD>
                  <TD className="font-mono text-xs">{r.id}</TD>
                  <TD>
                    <StatusBadge status={r.status} />
                    {r.error ? <div className="text-xs text-red-700">{r.error}</div> : null}
                  </TD>
                  <TD className="text-xs">
                    {r.provider} / {r.modelId}
                  </TD>
                  <TD>
                    {r.roundTrips} / {r.toolCalls}
                  </TD>
                  <TD className="max-w-xs text-xs">{r.userMessage}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : null}
      {!events.length ? (
        <EmptyState title="No activity yet">Actions you take and tools the copilot runs will appear here.</EmptyState>
      ) : (
        <Card>
          <Table>
            <caption className="sr-only">Tool and action events</caption>
            <THead>
              <tr>
                <TH>Time (UTC)</TH>
                <TH>Actor</TH>
                <TH>Tool / action</TH>
                <TH>Policy</TH>
                <TH>Outcome</TH>
                <TH>Args (sanitized)</TH>
              </tr>
            </THead>
            <TBody>
              {events.map((e) => (
                <TR key={e.id}>
                  <TD className="whitespace-nowrap font-mono text-xs">{e.at}</TD>
                  <TD>{e.actor}</TD>
                  <TD>
                    <code className="rounded bg-stone-100 px-1 text-xs">{e.tool}</code>
                  </TD>
                  <TD>
                    <StatusBadge status={e.policy} />
                  </TD>
                  <TD className="max-w-md text-sm">{e.outcome}</TD>
                  <TD className="max-w-xs break-all font-mono text-[11px] text-stone-600">{JSON.stringify(e.args)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
      <TruthNote>{client.mode === 'guided_local' ? TRUTH_LABELS.localLogs : TRUTH_LABELS.serverLogs}</TruthNote>
    </div>
  );
}
