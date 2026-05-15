/** @jsxRuntime automatic */
/** @jsxImportSource react */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { SyncSummaryData } from './sync-summary-data';

/**
 * Post-sync summary PDF. Attached to the "sync complete" email so operators
 * can see WHICH records the run touched, not just the count.
 *
 * Visual language matches `daily-brief-pdf.tsx` — same warm CRED palette,
 * same Helvetica face — so the two reports feel like one product line.
 *
 * react-pdf renders to a Buffer in-process; serverless-safe.
 */

const COLORS = {
  bg: '#FAF6EE',
  card: '#FFFFFF',
  text: '#1F1B16',
  secondary: '#5A4F40',
  muted: '#8A7E6E',
  border: '#E5DDD0',
  accent: '#B85C2A',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 44,
    paddingHorizontal: 36,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: COLORS.text,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottom: `1pt solid ${COLORS.border}`,
  },
  brandSub: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  brand: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -0.4,
  },
  date: {
    fontSize: 9,
    color: COLORS.secondary,
  },
  intro: {
    fontSize: 9,
    color: COLORS.secondary,
    paddingLeft: 8,
    borderLeft: `2pt solid ${COLORS.accent}`,
    marginBottom: 12,
    lineHeight: 1.4,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  kpi: {
    flex: 1,
    backgroundColor: COLORS.card,
    border: `1pt solid ${COLORS.border}`,
    borderRadius: 6,
    padding: 9,
  },
  kpiLabel: {
    fontSize: 7,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.text,
  },
  kpiHint: {
    fontSize: 7,
    color: COLORS.muted,
    marginTop: 3,
  },
  sectionLabel: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    marginBottom: 6,
    marginTop: 4,
  },
  flatHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottom: `1pt solid ${COLORS.border}`,
    backgroundColor: COLORS.card,
  },
  flatRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottom: `0.5pt solid ${COLORS.border}`,
    alignItems: 'center',
    backgroundColor: COLORS.card,
  },
  tCellH: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tCell: {
    fontSize: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: COLORS.muted,
  },
  truncationNote: {
    fontSize: 8,
    color: COLORS.muted,
    fontStyle: 'italic',
    marginTop: 8,
  },
});

function fmtUSD(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtUSDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

function fmtCount(n: number): string {
  return n.toLocaleString('en-US');
}

function buildSubtitle(data: SyncSummaryData): string {
  const finished = data.finishedAt ? new Date(data.finishedAt) : new Date();
  return finished.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function SyncHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.header} fixed>
      <View>
        <Text style={styles.brandSub}>Vera · Sync Report</Text>
        <Text style={styles.brand}>{title}</Text>
      </View>
      <Text style={styles.date}>{subtitle}</Text>
    </View>
  );
}

function SyncFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text>Vera Calloway · Priority Roofs</Text>
      <Text
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

function KPI({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {hint ? <Text style={styles.kpiHint}>{hint}</Text> : null}
    </View>
  );
}

function JobsTable({ rows }: { rows: SyncSummaryData['jobRows'] }) {
  return (
    <>
      <View style={styles.flatHeader} fixed>
        <Text style={[styles.tCellH, { width: 50 }]}>Job</Text>
        <Text style={[styles.tCellH, { flex: 2.2 }]}>Address</Text>
        <Text style={[styles.tCellH, { flex: 1.6 }]}>Customer</Text>
        <Text style={[styles.tCellH, { width: 60, textAlign: 'right' }]}>
          Installed
        </Text>
        <Text
          style={[styles.tCellH, { width: 70, textAlign: 'right', paddingRight: 4 }]}
        >
          Balance
        </Text>
      </View>
      {rows.map((r) => (
        <View key={r.rooflinkId} style={styles.flatRow} wrap={false}>
          <Text style={[styles.tCell, { width: 50, color: COLORS.muted }]}>
            {r.jobNumber !== null ? `#${r.jobNumber}` : r.rooflinkId}
          </Text>
          <Text style={[styles.tCell, { flex: 2.2 }]}>
            {r.address || '—'}
          </Text>
          <Text style={[styles.tCell, { flex: 1.6 }]}>
            {r.customerName ?? '—'}
          </Text>
          <Text
            style={[
              styles.tCell,
              { width: 60, textAlign: 'right', color: COLORS.secondary },
            ]}
          >
            {fmtUSDate(r.dateCompleted)}
          </Text>
          <Text
            style={[
              styles.tCell,
              { width: 70, textAlign: 'right', paddingRight: 4 },
            ]}
          >
            {fmtUSD(r.balance)}
          </Text>
        </View>
      ))}
    </>
  );
}

function LineItemsTable({ rows }: { rows: SyncSummaryData['lineItemsRows'] }) {
  return (
    <>
      <View style={styles.flatHeader} fixed>
        <Text style={[styles.tCellH, { flex: 1 }]}>Estimate ID</Text>
        <Text style={[styles.tCellH, { width: 70, textAlign: 'right' }]}>
          Line items
        </Text>
        <Text style={[styles.tCellH, { width: 60, textAlign: 'right' }]}>
          Discounts
        </Text>
        <Text
          style={[styles.tCellH, { width: 80, textAlign: 'right', paddingRight: 4 }]}
        >
          Work RCV total
        </Text>
      </View>
      {rows.map((r) => (
        <View key={r.estimateId} style={styles.flatRow} wrap={false}>
          <Text style={[styles.tCell, { flex: 1 }]}>{r.estimateId}</Text>
          <Text style={[styles.tCell, { width: 70, textAlign: 'right' }]}>
            {fmtCount(r.workDoingCount)}
          </Text>
          <Text style={[styles.tCell, { width: 60, textAlign: 'right' }]}>
            {fmtCount(r.discountsCount)}
          </Text>
          <Text
            style={[
              styles.tCell,
              { width: 80, textAlign: 'right', paddingRight: 4 },
            ]}
          >
            {fmtUSD(r.workDoingTotal)}
          </Text>
        </View>
      ))}
    </>
  );
}

export function SyncSummaryPDF({ data }: { data: SyncSummaryData }) {
  const title = `${data.sourceFriendly} sync`;
  const subtitle = buildSubtitle(data);
  const documentTitle = `Vera ${title} — ${subtitle}`;

  const intro =
    data.mode === 'incremental'
      ? `An incremental sync of ${data.sourceFriendly.toLowerCase()} completed cleanly. Below are the records updated since the last successful sync.`
      : `A full re-sync of ${data.sourceFriendly.toLowerCase()} completed cleanly. The list below shows the highest-value records in the refreshed snapshot — see the dashboard for the complete view.`;

  const processedHint =
    data.itemsTotal !== null && data.itemsTotal !== data.itemsProcessed
      ? `of ${fmtCount(data.itemsTotal)} attempted`
      : undefined;

  return (
    <Document title={documentTitle} author="Vera Calloway" subject={title}>
      <Page size="LETTER" style={styles.page}>
        <SyncHeader title={title} subtitle={subtitle} />

        <Text style={styles.intro}>{intro}</Text>

        <View style={styles.kpiRow}>
          <KPI
            label="Records touched"
            value={fmtCount(data.itemsProcessed)}
            hint={processedHint}
          />
          <KPI label="Mode" value={data.modeFriendly} />
          <KPI label="Duration" value={data.durationLabel} />
          <KPI label="Run reference" value={`#${data.runId}`} />
        </View>

        <Text style={styles.sectionLabel}>
          {data.mode === 'incremental'
            ? `Records updated · showing ${fmtCount(data.shownCount)}`
            : `Top records by balance · showing ${fmtCount(data.shownCount)}`}
        </Text>

        {data.source === 'rooflink_jobs' ? (
          <JobsTable rows={data.jobRows} />
        ) : (
          <LineItemsTable rows={data.lineItemsRows} />
        )}

        {data.truncated ? (
          <Text style={styles.truncationNote}>
            Showing {fmtCount(data.shownCount)} of {fmtCount(data.itemsProcessed)}{' '}
            records. Open the dashboard to browse the full set.
          </Text>
        ) : null}

        <SyncFooter />
      </Page>
    </Document>
  );
}

export async function renderSyncSummaryPDF(data: SyncSummaryData): Promise<Buffer> {
  return renderToBuffer(<SyncSummaryPDF data={data} />);
}
