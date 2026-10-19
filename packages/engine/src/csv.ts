import { CashEventSchema, LIMITS, type CashEvent } from './schemas';
import { parseMajor, toMajorInput, MoneyError } from './money';

/** Documented CSV columns. amount_bdt is a positive major-unit amount with at most two decimals. */
export const CSV_COLUMNS = ['id', 'direction', 'category', 'amount_bdt', 'date', 'status', 'description', 'source_ref'] as const;

export const CSV_TEMPLATE = `${CSV_COLUMNS.join(',')}\n`;

export interface CsvValidation {
  events: CashEvent[];
  errors: Array<{ row: number; message: string }>;
  duplicateIds: string[];
}

export function validateCsvHeaders(headers: string[]): string[] {
  const issues: string[] = [];
  const normalized = headers.map((h) => h.trim());
  for (const c of CSV_COLUMNS) if (!normalized.includes(c)) issues.push(`Missing column: ${c}`);
  for (const h of normalized) if (h && !(CSV_COLUMNS as readonly string[]).includes(h)) issues.push(`Unknown column: ${h}`);
  return issues;
}

/**
 * Validates already-parsed CSV rows as a full batch. Nothing is applied unless the whole
 * batch is valid; financial values are never repaired silently.
 */
export function validateCsvRows(rows: Array<Record<string, string | undefined>>, existingIds: Iterable<string> = []): CsvValidation {
  const errors: CsvValidation['errors'] = [];
  const events: CashEvent[] = [];
  const seen = new Set<string>();
  const existing = new Set(existingIds);
  const duplicateIds: string[] = [];
  if (rows.length > LIMITS.maxEventsPerWorkspace) {
    return { events: [], errors: [{ row: 0, message: `Too many rows (max ${LIMITS.maxEventsPerWorkspace}).` }], duplicateIds: [] };
  }
  rows.forEach((r, i) => {
    const rowNo = i + 2; // header is row 1
    let amountMinor: string;
    try {
      amountMinor = parseMajor(r.amount_bdt ?? '');
    } catch (e) {
      errors.push({ row: rowNo, message: `amount_bdt: ${e instanceof MoneyError ? e.message : 'invalid'}` });
      return;
    }
    const candidate = {
      id: (r.id ?? '').trim(),
      direction: (r.direction ?? '').trim(),
      category: (r.category ?? '').trim(),
      amountMinor,
      date: (r.date ?? '').trim(),
      status: (r.status ?? '').trim(),
      description: r.description ?? '',
      sourceRef: r.source_ref ?? '',
      version: 1,
    };
    const parsed = CashEventSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors.push({ row: rowNo, message: `${issue.path.join('.')}: ${issue.message}` });
      return;
    }
    if (seen.has(parsed.data.id) || existing.has(parsed.data.id)) {
      duplicateIds.push(parsed.data.id);
      errors.push({ row: rowNo, message: `Duplicate id: ${parsed.data.id}` });
      return;
    }
    seen.add(parsed.data.id);
    events.push(parsed.data);
  });
  return { events, errors, duplicateIds };
}

/** Neutralize spreadsheet formula injection for text cells. */
export function csvSafeText(value: string): string {
  const v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function eventsToCsv(events: CashEvent[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const e of events) {
    lines.push(
      [
        csvSafeText(e.id),
        e.direction,
        e.category,
        toMajorInput(e.amountMinor),
        e.date,
        e.status,
        csvSafeText(e.description),
        csvSafeText(e.sourceRef),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
