import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EVIDENCE_TYPES,
  SCHEMA_VERSION,
  TRUTH_LABELS,
  parseMajor,
  todayInBusinessZone,
  toMajorInput,
  type EvidenceType,
  type Workspace,
} from '@farmlink/engine';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError, Input, Label, Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { PageHeader, TruthNote } from '@/components/common';
import { useSandbox } from '@/state/SandboxProvider';
import { errorMessage } from '@/lib/utils';
import { LiveModeCard } from './LiveModeCard';

const EVIDENCE_LABEL: Record<EvidenceType, string> = {
  sales_records: 'Sales records',
  purchase_order: 'Purchase order(s)',
  cooperative_registration: 'Cooperative registration',
  trade_license: 'Trade license',
  bank_statement: 'Bank statement',
  member_list: 'Member list',
};

export function SetupPage() {
  const { snapshot, run, busy } = useSandbox();
  const navigate = useNavigate();
  const ws = snapshot?.workspace ?? null;
  const [form, setForm] = useState(() => ({
    businessName: ws?.businessName ?? '',
    businessType: ws?.businessType ?? 'cooperative',
    asOfDate: ws?.asOfDate ?? todayInBusinessZone(),
    openingCash: ws ? toMajorInput(ws.openingCashMinor) : '',
    buffer: ws ? toMajorInput(ws.minimumCashBufferMinor) : '0',
    forecastDays: String(ws?.forecastDays ?? 90),
    evidence: new Set<EvidenceType>(ws?.evidenceAvailable ?? []),
    consent: !!ws,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    let opening = '0';
    let buffer = '0';
    try {
      opening = parseMajor(form.openingCash, { allowNegative: true });
    } catch (err) {
      errs.openingCash = errorMessage(err);
    }
    try {
      buffer = parseMajor(form.buffer || '0');
    } catch (err) {
      errs.buffer = errorMessage(err);
    }
    if (!form.businessName.trim()) errs.businessName = 'Business name is required.';
    if (!form.consent) errs.consent = 'Please acknowledge the sandbox notice.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const next: Workspace = {
      schemaVersion: SCHEMA_VERSION,
      id: ws?.id ?? 'ws_local',
      businessName: form.businessName.trim(),
      businessType: form.businessType as Workspace['businessType'],
      currency: 'BDT',
      asOfDate: form.asOfDate,
      openingCashMinor: opening,
      minimumCashBufferMinor: buffer,
      forecastDays: Number(form.forecastDays) as Workspace['forecastDays'],
      evidenceAvailable: EVIDENCE_TYPES.filter((t) => form.evidence.has(t)),
      version: ws?.version ?? 0,
      provenance: ws?.provenance === 'sandbox_fixture' ? 'sandbox_fixture' : 'owner_entered',
    };
    const r = await run('Save workspace', (c) => c.saveWorkspace(next), { success: 'Workspace saved.' });
    if (r) navigate('/workspace');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace setup"
        description="Describe the business and the cash you have at the start of the as-of date. Amounts are in BDT."
        actions={
          <Button variant="secondary" disabled={busy} onClick={async () => (await run('Load demo', (c) => c.loadDemo(), { success: 'Demo loaded.' })) && navigate('/workspace')}>
            Load sandbox demo scenario
          </Button>
        }
      />
      <Alert variant="warning">
        <div>{TRUTH_LABELS.input}</div>
      </Alert>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Business profile</CardTitle>
            <CardDescription>The opening balance is cash available at the start of the as-of date. Settled events before that date are not added again.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit} noValidate>
              <div className="sm:col-span-2">
                <Label htmlFor="bn">Business name</Label>
                <Input id="bn" value={form.businessName} maxLength={80} aria-invalid={!!errors.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
                <FieldError>{errors.businessName}</FieldError>
              </div>
              <div>
                <Label htmlFor="bt">Business type</Label>
                <Select id="bt" value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value as Workspace['businessType'] })}>
                  <option value="cooperative">Agricultural cooperative</option>
                  <option value="agribusiness">Small agribusiness</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="cur">Currency</Label>
                <Input id="cur" value="BDT" disabled />
              </div>
              <div>
                <Label htmlFor="asof">As-of date (analysis start)</Label>
                <Input id="asof" type="date" value={form.asOfDate} onChange={(e) => setForm({ ...form, asOfDate: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="days">Forecast horizon</Label>
                <Select id="days" value={form.forecastDays} onChange={(e) => setForm({ ...form, forecastDays: e.target.value })}>
                  {[30, 60, 90, 120].map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="open">Opening cash (BDT)</Label>
                <Input id="open" inputMode="decimal" placeholder="350000" value={form.openingCash} aria-invalid={!!errors.openingCash} onChange={(e) => setForm({ ...form, openingCash: e.target.value })} />
                <FieldError>{errors.openingCash}</FieldError>
              </div>
              <div>
                <Label htmlFor="buf">Minimum cash buffer (BDT)</Label>
                <Input id="buf" inputMode="decimal" value={form.buffer} aria-invalid={!!errors.buffer} onChange={(e) => setForm({ ...form, buffer: e.target.value })} />
                <FieldError>{errors.buffer}</FieldError>
              </div>
              <fieldset className="sm:col-span-2">
                <legend className="text-sm font-medium">Supporting evidence you could provide (marked only, never uploaded)</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {EVIDENCE_TYPES.map((t) => (
                    <label key={t} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.evidence.has(t)}
                        onChange={(e) => {
                          const s = new Set(form.evidence);
                          if (e.target.checked) s.add(t);
                          else s.delete(t);
                          setForm({ ...form, evidence: s });
                        }}
                      />
                      {EVIDENCE_LABEL[t]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="mt-1" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
                <span>I understand this is a competition sandbox. Data in guided mode is stored only in this browser and can be edited or reset by me.</span>
              </label>
              <FieldError>{errors.consent}</FieldError>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={busy}>
                  Save workspace
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <LiveModeCard />
          <Card>
            <CardHeader>
              <CardTitle>Reset</CardTitle>
              <CardDescription>Delete all records, drafts, receipts, and logs for the current mode.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm('Delete all data for the current mode? This cannot be undone.')) return;
                  await run('Reset', (c) => c.reset(), { success: 'Workspace reset.' });
                  navigate('/');
                }}
              >
                Reset workspace data
              </Button>
              <div className="mt-3">
                <TruthNote>Guided mode deletes the IndexedDB copy in this browser. Live mode deletes the server session documents.</TruthNote>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
