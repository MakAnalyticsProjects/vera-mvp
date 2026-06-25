// Helpers — currency, date formatting. Phase 2 fills this in.
export const formatUSD = (amount: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);

/** US MM/DD/YYYY. Returns "—" for null/undefined/unparseable input. */
export function formatUSDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  // A date-only value (YYYY-MM-DD) is a calendar date with no timezone — the
  // same day everywhere. `new Date('2026-05-02')` parses it as UTC midnight, so
  // reading local calendar parts rolls it back a day for any user west of UTC
  // (e.g. Dallas). Format the parts directly instead of round-tripping through Date.
  const dateOnly = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, yyyy, mm, dd] = dateOnly;
    return `${mm}/${dd}/${yyyy}`;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}
