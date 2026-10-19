import { Receipt } from 'lucide-react';
import type { SandboxReceipt } from '@farmlink/engine';
import { ModeBadge } from '@/components/common';

export function ReceiptCard({ receipt }: { receipt: SandboxReceipt }) {
  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50/50 p-3 text-sm" data-testid="receipt">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Receipt className="size-4 text-emerald-800" aria-hidden />
        <strong>{receipt.label}</strong>
        <ModeBadge mode={receipt.mode} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-stone-600">Receipt ID</dt>
        <dd className="font-mono break-all">{receipt.receiptId}</dd>
        <dt className="text-stone-600">Application</dt>
        <dd className="font-mono break-all">{receipt.applicationId}</dd>
        <dt className="text-stone-600">Status</dt>
        <dd>{receipt.status}</dd>
        <dt className="text-stone-600">Destination</dt>
        <dd>{receipt.destination}</dd>
        <dt className="text-stone-600">Submitted at (UTC)</dt>
        <dd className="font-mono">{receipt.submittedAt}</dd>
        <dt className="text-stone-600">Action</dt>
        <dd className="font-mono break-all">{receipt.actionId}</dd>
        <dt className="text-stone-600">Payload hash</dt>
        <dd className="font-mono break-all">{receipt.payloadHash}</dd>
        <dt className="text-stone-600">Versions</dt>
        <dd>
          draft v{receipt.draftVersion} · workspace v{receipt.workspaceVersion} · catalog v{receipt.catalogVersion}
        </dd>
      </dl>
    </div>
  );
}
