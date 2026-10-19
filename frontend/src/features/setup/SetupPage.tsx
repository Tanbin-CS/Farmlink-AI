import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, RotateCcw, ShieldAlert, Trash2 } from 'lucide-react';
import {
  CURRENCIES,
  DEFAULT_RATES_NOTE,
  DEFAULT_REFERENCE_RATES,
  EVIDENCE_TYPES,
  SCHEMA_VERSION,
  TRUTH_LABELS,
  isValidRate,
  parseMajor,
  todayInBusinessZone,
  toMajorInput,
  type CurrencyCode,
  type EvidenceType,
  type Workspace,
} from '@farmlink/engine';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError, Input, Label, Select } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { PageHeader, TruthNote } from '@/components/common';
import { DemoLauncher } from '@/components/DemoLauncher';
import { useSandbox } from '@/state/SandboxProvider';
import { usePreferences } from '@/state/PreferencesProvider';
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
    currency: (ws?.currency ?? 'BDT') as CurrencyCode,
    asOfDate: ws?.asOfDate ?? todayInBusinessZone(),
    openingCash: ws ? toMajorInput(ws.openingCashMinor) : '',
    buffer: ws ? toMajorInput(ws.minimumCashBufferMinor) : '0',
    forecastDays: String(ws?.forecastDays ?? 90),
    evidence: new Set<EvidenceType>(ws?.evidenceAvailable ?? []),
    consent: !!ws,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const currencyChanged = !!ws && ws.currency !== form.currency;

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
      currency: form.currency,
      asOfDate: form.asOfDate,
      openingCashMinor: opening,
      minimumCashBufferMinor: buffer,
      forecastDays: Number(form.forecastDays) as Workspace['forecastDays'],
      evidenceAvailable: EVIDENCE_TYPES.filter((t) => form.evidence.has(t)),
      financingTarget: ws?.financingTarget ?? 'gap',
      version: ws?.version ?? 0,
      provenance: ws?.provenance === 'sandbox_fixture' ? 'sandbox_fixture' : 'owner_entered',
    };
    const r = await run('Save workspace', (c) => c.saveWorkspace(next), { success: 'Business profile saved.' });
    if (r) navigate(r.events.length ? '/workspace' : '/records');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Step 1 · Profile"
        title="Business profile"
        description="Tell the copilot about the business and the cash you hold at the start of the analysis. You can also start from the fictional demo."
      />
      <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-white">
        <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold">Just exploring?</div>
            <p className="text-sm text-stone-600">Load a fictional cooperative that runs short of cash before harvest. Pick the currency you prefer to read.</p>
          </div>
          <DemoLauncher navigateTo="/workspace" label="Load demo" />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Your business</CardTitle>
            <CardDescription>Opening cash is what you hold at the start of the as-of date. Settled payments before that date are not added again.</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="warning" className="mb-5">
              <ShieldAlert aria-hidden />
              <div>{TRUTH_LABELS.input}</div>
            </Alert>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit} noValidate>
              <div className="sm:col-span-2">
                <Label htmlFor="bn">Business name</Label>
                <Input id="bn" className="mt-1" value={form.businessName} maxLength={80} aria-invalid={!!errors.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
                <FieldError>{errors.businessName}</FieldError>
              </div>
              <div>
                <Label htmlFor="bt">Business type</Label>
                <Select id="bt" className="mt-1" value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value as Workspace['businessType'] })}>
                  <option value="cooperative">Agricultural cooperative</option>
                  <option value="agribusiness">Small agribusiness</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="cur">Currency of your records</Label>
                <Select id="cur" className="mt-1" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as CurrencyCode })}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c === 'BDT' ? 'BDT, Bangladeshi taka' : c === 'USD' ? 'USD, US dollar' : 'EUR, euro'}
                    </option>
                  ))}
                </Select>
                {currencyChanged ? <FieldError>Existing amounts are not converted. Only products in {form.currency} will be compared.</FieldError> : null}
              </div>
              <div>
                <Label htmlFor="asof">As-of date (analysis start)</Label>
                <Input id="asof" className="mt-1" type="date" value={form.asOfDate} onChange={(e) => setForm({ ...form, asOfDate: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="days">Forecast horizon</Label>
                <Select id="days" className="mt-1" value={form.forecastDays} onChange={(e) => setForm({ ...form, forecastDays: e.target.value })}>
                  {[30, 60, 90, 120].map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="open">Opening cash ({form.currency})</Label>
                <Input id="open" className="mt-1" inputMode="decimal" placeholder="350000" value={form.openingCash} aria-invalid={!!errors.openingCash} onChange={(e) => setForm({ ...form, openingCash: e.target.value })} />
                <FieldError>{errors.openingCash}</FieldError>
              </div>
              <div>
                <Label htmlFor="buf">Minimum cash buffer ({form.currency})</Label>
                <Input id="buf" className="mt-1" inputMode="decimal" value={form.buffer} aria-invalid={!!errors.buffer} onChange={(e) => setForm({ ...form, buffer: e.target.value })} />
                <FieldError>{errors.buffer}</FieldError>
              </div>
              <fieldset className="sm:col-span-2">
                <legend className="text-sm font-medium">Supporting evidence you could provide</legend>
                <p className="text-xs text-stone-500">Marked only. Files are never uploaded.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EVIDENCE_TYPES.map((t) => {
                    const on = form.evidence.has(t);
                    return (
                      <label key={t} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? 'border-brand-300 bg-brand-50 text-brand-900' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={(e) => {
                            const s = new Set(form.evidence);
                            if (e.target.checked) s.add(t);
                            else s.delete(t);
                            setForm({ ...form, evidence: s });
                          }}
                        />
                        <span aria-hidden>{on ? '✓' : '+'}</span>
                        {EVIDENCE_LABEL[t]}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="mt-1" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
                <span>I understand this is a competition sandbox. In guided mode, data stays in this browser and I can edit or reset it.</span>
              </label>
              <FieldError>{errors.consent}</FieldError>
              <div className="sm:col-span-2">
                <Button type="submit" size="lg" disabled={busy}>
                  Save and continue
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <PreferencesCard />
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
                <Trash2 aria-hidden /> Reset workspace data
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PreferencesCard() {
  const { prefs, update, resetRates } = usePreferences();
  const [draft, setDraft] = useState(prefs.rates);
  const bad = (['USD', 'EUR'] as const).filter((c) => !isValidRate(draft[c]));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="size-4 text-harvest-500" aria-hidden /> Display currency
        </CardTitle>
        <CardDescription>Show approximate equivalents next to amounts for international readers. Calculations always use the workspace currency.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pref-cur">Also show</Label>
            <Select id="pref-cur" className="mt-1" value={prefs.displayCurrency} onChange={(e) => update({ displayCurrency: e.target.value as Preferences['displayCurrency'] })}>
              <option value="USD">≈ USD</option>
              <option value="EUR">≈ EUR</option>
              <option value="BDT">≈ BDT</option>
              <option value="none">Nothing</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="pref-group">Number style</Label>
            <Select id="pref-group" className="mt-1" value={prefs.grouping} onChange={(e) => update({ grouping: e.target.value as Preferences['grouping'] })}>
              <option value="international">1,234,567</option>
              <option value="south_asian">12,34,567 (lakh)</option>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(['USD', 'EUR'] as const).map((c) => (
            <div key={c}>
              <Label htmlFor={`rate-${c}`}>BDT per 1 {c}</Label>
              <Input
                id={`rate-${c}`}
                className="mt-1"
                inputMode="decimal"
                value={draft[c]}
                aria-invalid={!isValidRate(draft[c])}
                onChange={(e) => {
                  const next = { ...draft, [c]: e.target.value.trim() };
                  setDraft(next);
                  if (isValidRate(next[c])) update({ rates: { ...prefs.rates, [c]: next[c] } });
                }}
              />
            </div>
          ))}
        </div>
        {bad.length ? <FieldError>Enter a positive rate with up to 4 decimals.</FieldError> : null}
        <TruthNote>{DEFAULT_RATES_NOTE}</TruthNote>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            resetRates();
            setDraft(DEFAULT_REFERENCE_RATES);
          }}
        >
          <RotateCcw aria-hidden /> Restore default rates
        </Button>
      </CardContent>
    </Card>
  );
}

type Preferences = ReturnType<typeof usePreferences>['prefs'];
