/**
 * Pure parser for a regional "Installs & Payments" CSV export (e.g.
 * `data/Dallas - Installs & Payments - May 2026.csv`). Shared by the live
 * importer (`import-install-payments.ts`) and the Playwright seed generator
 * (`generate-vera-test-seed.ts`) so both read the sheet identically.
 *
 * No I/O here — callers read the file and pass the text in.
 */

export interface InstallPaymentSheetRow {
  /** 1-based CSV line number (data rows only). Stable natural key. */
  sourceRow: number;
  salesRep: string;
  customerName: string;
  address: string;
  /** ISO date 'YYYY-MM-DD'. */
  installDate: string;
  contractPrice: number | null;
  payment1: number | null;
  payment2: number | null;
  payment3: number | null;
  payment4: number | null;
  balanceOwed: number | null;
}

/** Minimal RFC-4180 CSV parser (handles quoted fields with embedded commas). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** "15,226.00" → 15226; "-4,825.70" → -4825.7; blank → null. */
export function parseMoney(raw: string | undefined): number | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/[$,\s]/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** "05/02/2026" → '2026-05-02'; unparseable/blank → null. */
export function parseInstallDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/** Sheet-level provenance from the "Last Reviewed …" annotation row. */
export interface InstallPaymentSheetMeta {
  /** "Last Reviewed" date label as written, e.g. "05/11". null if absent. */
  reviewedLabel: string | null;
  /** Clearing/deposit caveat written on the annotation row, e.g.
   * "NOT YET CLEARED/DEPOSITED". null if absent. */
  clearingNote: string | null;
}

/**
 * Extract the sheet-keeper's annotation (review date + clearing caveat) that
 * sits in a non-data row near the top, e.g.
 * `Last Reviewed: 05/11   EF,,NOT YET CLEARED/DEPOSITED,,…`.
 */
export function parseInstallPaymentsAnnotation(text: string): InstallPaymentSheetMeta {
  const rows = parseCsv(text);
  for (const r of rows) {
    const first = (r[0] ?? '').trim();
    const m = first.match(/Last Reviewed:\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
    if (!m) continue;
    const clearingNote =
      r
        .slice(1)
        .map((c) => c.trim())
        .find((c) => c !== '') ?? null;
    return { reviewedLabel: m[1], clearingNote };
  }
  return { reviewedLabel: null, clearingNote: null };
}

/**
 * Parse the CSV text into install rows. Skips the header row, the
 * "Last Reviewed …" annotation row, and blank separator rows (a real
 * install always has a customer name AND a parseable install date).
 */
export function parseInstallPaymentsCsv(text: string): InstallPaymentSheetRow[] {
  const rows = parseCsv(text);
  const out: InstallPaymentSheetRow[] = [];
  // rows[0] is the header. CSV line number = index + 1.
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (col: number): string => (r[col] ?? '').trim();
    const customerName = get(1);
    const installDate = parseInstallDate(get(3));
    if (customerName === '' || installDate === null) continue;
    out.push({
      sourceRow: i + 1,
      salesRep: get(0),
      customerName,
      address: get(2),
      installDate,
      contractPrice: parseMoney(get(4)),
      payment1: parseMoney(get(5)),
      payment2: parseMoney(get(6)),
      payment3: parseMoney(get(7)),
      payment4: parseMoney(get(8)),
      balanceOwed: parseMoney(get(9)),
    });
  }
  return out;
}
