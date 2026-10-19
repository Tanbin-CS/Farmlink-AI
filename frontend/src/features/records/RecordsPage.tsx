import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import Papa from 'papaparse';
import { ArrowDownRight, ArrowUpRight, Download, FileUp, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  CSV_TEMPLATE,
  LIMITS,
  eventsToCsv,
  parseMajor,
  randomId,
  toMajorInput,
  validateCsvHeaders,
  validateCsvRows,
  CashEventSchema,
  type CashEvent,
  type CsvValidation,
} from '@farmlink/engine';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldError, Input, Label, Select } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Alert } from '@/components/ui/alert';
import { Money, PageHeader, StatusBadge, TruthNote } from '@/components/common';
import { useSandbox } from '@/state/SandboxProvider';
import { RequireWorkspace } from '@/app/RequireWorkspace';
import { cn, downloadText, errorMessage } from '@/lib/utils';
import { motion } from '@/components/motion';

const CATEGORIES: CashEvent['category'][] = ['sales_receipt', 'input_cost', 'transport', 'operating_cost', 'debt_repayment', 'other'];

export function RecordsPage() {
  return (
    <RequireWorkspace>
      <RecordsInner />
    </RequireWorkspace>
  );
}

function RecordsInner() {
  const { snapshot, run, busy } = useSandbox();
  const events = snapshot!.events;
  const [status, setStatus] = useState('all');
  const [direction, setDirection] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [editing, setEditing] = useState<CashEvent | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [preview, setPreview] = useState<(CsvValidation & { headerIssues: string[]; fileName: string }) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('new') === '1') {
      setEditing(null);
      setEditorOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);
  const totals = useMemo(() => {
    let inflow = 0n;
    let outflow = 0n;
    for (const e of events) {
      if (e.status !== 'planned') continue;
      if (e.direction === 'inflow') inflow += BigInt(e.amountMinor);
      else outflow += BigInt(e.amountMinor);
    }
    return { inflow: inflow.toString(), outflow: outflow.toString() };
  }, [events]);

  const filtered = useMemo(
    () =>
      [...events]
        .filter((e) => (status === 'all' || e.status === status) && (direction === 'all' || e.direction === direction) && (!from || e.date >= from) && (!to || e.date <= to))
        .filter((e) => !query.trim() || `${e.id} ${e.description} ${e.sourceRef} ${e.category}`.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date))),
    [events, status, direction, from, to, query],
  );

  const onFile = (file: File) => {
    if (file.size > LIMITS.maxImportBytes) {
      setPreview({ events: [], errors: [{ row: 0, message: `File is larger than ${LIMITS.maxImportBytes / 1024} KiB.` }], duplicateIds: [], headerIssues: [], fileName: file.name });
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const headerIssues = validateCsvHeaders(res.meta.fields ?? []);
        const v = headerIssues.length ? { events: [], errors: [], duplicateIds: [] } : validateCsvRows(res.data, events.map((e) => e.id));
        setPreview({ ...v, headerIssues, fileName: file.name });
      },
      error: (err) => setPreview({ events: [], errors: [{ row: 0, message: err.message }], duplicateIds: [], headerIssues: [], fileName: file.name }),
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Step 2 · Records"
        title="Cash records"
        description="Dated inflows and outflows. A settled event's date is when cash actually moved; a planned event's date is when it is expected."
        actions={
          <>
            <Button
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              <Plus aria-hidden /> Add record
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <FileUp aria-hidden /> Import CSV
            </Button>
            <Button variant="outline" onClick={() => downloadText('farmlink-records.csv', eventsToCsv(events), 'text/csv')}>
              <Download aria-hidden /> Export CSV
            </Button>
            <Button variant="ghost" onClick={() => downloadText('farmlink-template.csv', CSV_TEMPLATE, 'text/csv')}>
              CSV template
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              aria-label="CSV file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = '';
              }}
            />
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-stone-200/80">
          <div className="text-xs font-medium text-stone-500">Records</div>
          <div className="mt-1 text-2xl font-semibold">{events.length}</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-emerald-200">
          <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
            <ArrowDownRight className="size-3.5 text-emerald-600" aria-hidden /> Planned money in
          </div>
          <Money value={totals.inflow} decimals={false} className="mt-1 block text-2xl font-semibold" />
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-red-200">
          <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
            <ArrowUpRight className="size-3.5 text-red-600" aria-hidden /> Planned money out
          </div>
          <Money value={totals.outflow} decimals={false} className="mt-1 block text-2xl font-semibold" />
        </div>
      </div>
      <Card>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-1">
            <Label htmlFor="f-q">Search</Label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-stone-400" aria-hidden />
              <Input id="f-q" className="pl-8" placeholder="seed, wages, PO…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="f-status">Status</Label>
            <Select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="planned">Planned</option>
              <option value="settled">Settled</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="f-dir">Direction</Label>
            <Select id="f-dir" value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="all">All</option>
              <option value="inflow">Inflow</option>
              <option value="outflow">Outflow</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="f-from">From</Label>
            <Input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="f-to">To</Label>
            <Input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>
      <div className="space-y-2 md:hidden">
        {filtered.map((e, i) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 8) * 0.03 }}
            className={cn('flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[var(--shadow-card)] ring-1 ring-stone-200/80', e.status === 'cancelled' && 'opacity-60')}
          >
            <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', e.direction === 'inflow' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
              {e.direction === 'inflow' ? <ArrowDownRight className="size-5" aria-label="inflow" /> : <ArrowUpRight className="size-5" aria-label="outflow" />}
            </span>
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                setEditing(e);
                setEditorOpen(true);
              }}
            >
              <div className="truncate text-sm font-medium">{e.description || e.id}</div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                {e.date} · <StatusBadge status={e.status} />
              </div>
            </button>
            <Money value={e.direction === 'outflow' ? `-${e.amountMinor}` : e.amountMinor} signed decimals={false} className="text-sm font-semibold" />
          </motion.div>
        ))}
        {!filtered.length ? <p className="py-6 text-center text-sm text-stone-500">No records match.</p> : null}
      </div>
      <Card className="hidden md:block">
        <Table>
          <caption className="sr-only">Cash records</caption>
          <THead>
            <tr>
              <TH>Date</TH>
              <TH>ID</TH>
              <TH>Direction</TH>
              <TH>Category</TH>
              <TH className="text-right">Amount</TH>
              <TH>Status</TH>
              <TH>Description / source</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {filtered.map((e) => (
              <TR key={e.id}>
                <TD className="whitespace-nowrap tabular">{e.date}</TD>
                <TD className="font-mono text-xs">{e.id}</TD>
                <TD>{e.direction}</TD>
                <TD>{e.category.replace(/_/g, ' ')}</TD>
                <TD className="text-right">
                  <Money value={e.direction === 'outflow' ? `-${e.amountMinor}` : e.amountMinor} signed />
                </TD>
                <TD>
                  <StatusBadge status={e.status} />
                </TD>
                <TD className="max-w-xs">
                  {/* Rendered as text; record content is never interpreted as markup or instructions. */}
                  <div>{e.description}</div>
                  <div className="text-xs text-stone-500">{e.sourceRef}</div>
                </TD>
                <TD className="whitespace-nowrap">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Edit ${e.id}`}
                    onClick={() => {
                      setEditing(e);
                      setEditorOpen(true);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={`Delete ${e.id}`} disabled={busy} onClick={() => run('Delete', (c) => c.deleteEvent(e.id), { success: `Deleted ${e.id}.` })}>
                    <Trash2 />
                  </Button>
                </TD>
              </TR>
            ))}
            {!filtered.length ? (
              <TR>
                <TD colSpan={8} className="py-8 text-center text-stone-600">
                  No records match.
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </Card>
      <TruthNote>
        {events.length} of {LIMITS.maxEventsPerWorkspace} records. Every edit increments the workspace version, which invalidates pending confirmations.
      </TruthNote>
      {editorOpen ? <EventEditor key={editing?.id ?? 'new'} open={editorOpen} onOpenChange={setEditorOpen} initial={editing} existingIds={events.map((e) => e.id)} /> : null}
      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import preview: {preview?.fileName}</DialogTitle>
            <DialogDescription>The whole batch is validated. Nothing is imported unless every row is valid.</DialogDescription>
          </DialogHeader>
          {preview?.headerIssues.length ? (
            <Alert variant="danger">
              <ul className="list-disc pl-4">
                {preview.headerIssues.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
          {preview?.errors.length ? (
            <Alert variant="danger">
              <div>
                <strong>{preview.errors.length} error(s):</strong>
                <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-4">
                  {preview.errors.slice(0, 50).map((er, i) => (
                    <li key={i}>
                      Row {er.row}: {er.message}
                    </li>
                  ))}
                </ul>
              </div>
            </Alert>
          ) : null}
          {preview && !preview.errors.length && !preview.headerIssues.length ? (
            <Alert variant="success">
              <div>{preview.events.length} valid row(s) ready to import.</div>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button
              disabled={!preview || !!preview.errors.length || !!preview.headerIssues.length || !preview.events.length || busy}
              onClick={async () => {
                const r = await run('Import', (c) => c.importEvents(preview!.events), { success: `Imported ${preview!.events.length} record(s).` });
                if (r) setPreview(null);
              }}
            >
              Import all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventEditor({ open, onOpenChange, initial, existingIds }: { open: boolean; onOpenChange: (v: boolean) => void; initial: CashEvent | null; existingIds: string[] }) {
  const { run, busy, snapshot } = useSandbox();
  const [form, setForm] = useState(() => (initial ? { ...initial, amount: toMajorInput(initial.amountMinor) } : blank(snapshot?.workspace?.asOfDate ?? '')));
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (!initial && existingIds.includes(form.id)) throw new Error('A record with this ID already exists.');
      const event = CashEventSchema.parse({
        id: form.id,
        direction: form.direction,
        category: form.category,
        amountMinor: parseMajor(form.amount),
        date: form.date,
        status: form.status,
        description: form.description,
        sourceRef: form.sourceRef,
        version: initial?.version ?? 0,
      });
      const r = await run('Save record', (c) => c.upsertEvent(event), { success: `Saved ${event.id}.` });
      if (r) onOpenChange(false);
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg.startsWith('[') ? 'Please check the highlighted values (ID, amount, date).' : msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.id}` : 'Add cash record'}</DialogTitle>
          <DialogDescription>Do not enter identity documents, account numbers, or confidential data.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
          <div>
            <Label htmlFor="e-id">ID</Label>
            <Input id="e-id" value={form.id} disabled={!!initial} onChange={(e) => setForm({ ...form, id: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="e-date">{form.status === 'settled' ? 'Actual movement date' : 'Expected movement date'}</Label>
            <Input id="e-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="e-dir">Direction</Label>
            <Select id="e-dir" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as CashEvent['direction'] })}>
              <option value="inflow">Inflow</option>
              <option value="outflow">Outflow</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="e-cat">Category</Label>
            <Select id="e-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as CashEvent['category'] })}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="e-amt">Amount ({snapshot?.workspace?.currency ?? 'BDT'}, positive)</Label>
            <Input id="e-amt" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="e-status">Status</Label>
            <Select id="e-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CashEvent['status'] })}>
              <option value="planned">Planned</option>
              <option value="settled">Settled</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="e-desc">Description</Label>
            <Input id="e-desc" maxLength={280} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="e-src">Source reference</Label>
            <Input id="e-src" maxLength={120} value={form.sourceRef} onChange={(e) => setForm({ ...form, sourceRef: e.target.value })} placeholder="e.g. ledger page, PO number" />
          </div>
          <div className="sm:col-span-2">
            <FieldError>{error}</FieldError>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function blank(date: string) {
  return {
    id: randomId('ev', 6).replace('_', '-'),
    direction: 'outflow' as CashEvent['direction'],
    category: 'input_cost' as CashEvent['category'],
    amount: '',
    date,
    status: 'planned' as CashEvent['status'],
    description: '',
    sourceRef: '',
  };
}
