import { ENGINE_VERSION, MODE_LABEL, TRUTH_LABELS } from '@farmlink/engine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModeBadge, PageHeader } from '@/components/common';
import { useSandbox } from '@/state/SandboxProvider';
import { config, liveModeConfigured } from '@/lib/config';

export function AboutPage() {
  const { client } = useSandbox();
  return (
    <div className="space-y-6">
      <PageHeader title="About, limits, and privacy" description="What runs now, what is deferred, and how data is handled." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Build and mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Deployed frontend commit: <code className="rounded bg-stone-100 px-1">{config.buildSha}</code>
            </p>
            <p>Financial engine: v{ENGINE_VERSION} (shared by the browser sandbox and the live API)</p>
            <p className="flex flex-wrap items-center gap-2">
              Active mode: <ModeBadge mode={client.mode} />
            </p>
            <p>Live API: {liveModeConfigured ? config.apiBaseUrl : 'not configured in this build'}</p>
            <p>
              Source:{' '}
              <a className="text-brand-800 underline" href={config.repoUrl} target="_blank" rel="noreferrer">
                {config.repoUrl}
              </a>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Modes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>{MODE_LABEL.guided_local}.</strong> Deterministic tools run in your browser against local records (IndexedDB). Receipts read “Local sandbox receipt —
              browser only”. Suitable for functionality review; it is not a live AI agent.
            </p>
            <p>
              <strong>{MODE_LABEL.live_cloud}.</strong> A tool-calling model on a separate API proposes allowlisted tools; server code validates arguments, enforces session
              ownership, quotas, and human confirmation, and writes durable sandbox receipts. The model cannot confirm submissions.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Implemented now</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Workspace setup, record editor, validated atomic CSV import, formula-safe CSV export</li>
              <li>Daily cash-flow projection with buffer and negative-cash alerts</li>
              <li>Financing comparison: minimum principal search, timing, repayment window, reason codes</li>
              <li>Application drafts, exact-payload binding (SHA-256), 5-minute expiry, explicit confirmation, idempotent receipts</li>
              <li>Activity log and exportable execution evidence (optionally redacted)</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Deferred or excluded</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Real loans, disbursements, payments, or lender integrations</li>
              <li>NID / Farmer Card verification, KYC, credit bureau, government APIs</li>
              <li>Hyperledger, DIDs, verifiable credentials, ZKPs (original FarmLink roadmap only)</li>
              <li>Crop-yield or price forecasts, default probabilities, automated approval</li>
              <li>Reducing-balance or compounding loan structures</li>
              <li>Bengali localization (future work)</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Prior work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              FarmLink began as an earlier team proposal (blockchain-based agricultural financing ecosystem) prepared for a different event. That proposal contained no working
              software. This prototype keeps the name and the agricultural financing problem and implements a new, working financial-agent workflow. See PRIOR_WORK.md in the
              repository.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Privacy and reset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{TRUTH_LABELS.input}</p>
            <p>Guided mode stores data only in this browser; use Setup → Reset to delete it. Live mode stores session data on the sandbox API until the session expires or you reset it.</p>
            <p>No analytics, cookies, or third-party trackers are used by this site.</p>
            <p>{TRUTH_LABELS.prototype} No affiliation with or endorsement by any bank, lender, agency, or the competition organizers is implied.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
