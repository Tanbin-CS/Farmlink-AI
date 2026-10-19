import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ShieldCheck, Timer } from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion } from '@/components/motion';
import { GLOSSARY, Term } from '@/components/Term';
import { DESTINATION, randomId, type PendingAction, type SandboxReceipt } from '@farmlink/engine';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Money, TruthNote } from '@/components/common';
import { useSandbox } from '@/state/SandboxProvider';
import { ReceiptCard } from './ReceiptCard';

function useCountdown(expiresAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (!expiresAt) return { expired: false, label: '' };
  const ms = Date.parse(expiresAt) - now;
  const s = Math.max(0, Math.floor(ms / 1000));
  return { expired: ms <= 0, label: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` };
}

/**
 * Human confirmation of an exact, frozen sandbox action. This dialog is the only path
 * to SANDBOX_SUBMITTED; no chat message or model output can trigger it.
 */
export function ReviewDialog({ action, open, onOpenChange }: { action: PendingAction | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { run, busy, client } = useSandbox();
  const idemKey = useRef<string>('');
  const [receipt, setReceipt] = useState<SandboxReceipt | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const { expired, label } = useCountdown(action?.expiresAt);

  useEffect(() => {
    if (open) {
      idemKey.current = randomId('idem', 16);
      setReceipt(null);
      setAcknowledged(false);
    }
  }, [open, action?.id]);

  if (!action) return null;
  const p = action.payload;

  const confirm = async () => {
    const r = await run('Confirm sandbox submission', (c) => c.confirm(action.id, idemKey.current), { success: 'Sandbox submission recorded.' });
    if (r) {
      setReceipt(r);
      void confetti({ particleCount: 90, spread: 70, startVelocity: 32, origin: { y: 0.35 }, colors: ['#259863', '#f5b52e', '#7fd1a6', '#10402e'], disableForReducedMotion: true, zIndex: 80 });
    }
  };
  const cancel = async () => {
    await run('Cancel', (c) => c.cancel(action.id), { success: 'Pending submission cancelled.' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{receipt ? 'Sandbox submission receipt' : 'Review and confirm sandbox submission'}</DialogTitle>
          <DialogDescription>
            Destination: <strong>{DESTINATION}</strong>. No real lender receives anything. This is not a loan approval.
          </DialogDescription>
        </DialogHeader>

        {receipt ? (
          <div className="space-y-3">
            <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-9" aria-hidden />
            </motion.div>
            <Alert variant="success">
              <CheckCircle2 aria-hidden />
              <div>Recorded as SANDBOX_SUBMITTED. This means the internal simulator received the application. It was not approved, paid, or sent to any institution.</div>
            </Alert>
            <ReceiptCard receipt={receipt} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-lg border border-stone-200 p-3 text-sm sm:grid-cols-2">
              <Row k="Product" v={`${p.productId}`} />
              <Row k="Principal" v={<Money value={p.quote.principalMinor} />} />
              <Row k="Upfront fee" v={<Money value={p.quote.feeMinor} />} />
              <Row k="Net cash received" v={<Money value={p.quote.netCashReceivedMinor} />} />
              <Row k="Interest (simple)" v={<Money value={p.quote.interestMinor} />} />
              <Row k="Repayment at maturity" v={<Money value={p.quote.maturityRepaymentMinor} />} />
              <Row k="Modeled disbursement" v={p.disbursementDate} />
              <Row k="Maturity" v={p.maturityDate} />
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold">Fields that will be shared with the simulator</h3>
              <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 text-sm">
                {p.sharedFields.map((f) => (
                  <li key={f.key} className="flex justify-between gap-3 px-3 py-1.5">
                    <span className="text-stone-600">{f.label}</span>
                    <span className="text-right font-medium">{f.value}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-stone-600">Record IDs shared: {p.sharedRecordIds.join(', ') || 'none'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="size-3.5" aria-hidden /> <Term tip={GLOSSARY.payloadHash}>Payload hash</Term> {action.payloadHash.slice(0, 16)}…
              </span>
              <span className={`inline-flex items-center gap-1 ${expired ? 'text-red-700' : ''}`}>
                <Timer className="size-3.5" aria-hidden /> {expired ? 'Expired: prepare again' : `Expires in ${label}`}
              </span>
              <span>Draft v{p.draftVersion} · workspace v{p.workspaceVersion} · catalog v{p.catalogVersion}</span>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
              <span>I reviewed these exact terms and shared fields. I understand this is a sandbox simulation with no real loan, payment, or lender submission.</span>
            </label>
            <TruthNote>Any edit to the draft, records, or catalog invalidates this confirmation and requires a new review.</TruthNote>
            {client.mode === 'guided_local' ? <TruthNote>Guided mode: the receipt is generated in this browser only.</TruthNote> : null}
          </div>
        )}

        <DialogFooter>
          {receipt ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={cancel} disabled={busy}>
                Cancel submission
              </Button>
              <Button onClick={confirm} disabled={busy || expired || !acknowledged || action.status !== 'pending'}>
                Confirm sandbox submission
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-stone-600">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}
