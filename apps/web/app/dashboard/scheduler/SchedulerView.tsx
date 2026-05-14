'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Send,
  Trash2,
} from 'lucide-react';
import {
  Button,
  Card,
  EmailChipInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  SkeletonText,
  Switch,
  Tab,
  Tabs,
  TabsContent,
  TabsList,
  TimePicker,
  toast,
  useConfirm,
} from '@vera/ui';
import { DataSyncSection } from './DataSyncSection';

/**
 * Scheduler — recurring report delivery configuration.
 *
 * Three states per cadence, each with one primary action:
 *   A. Unscheduled (no DB row) — form open, primary "Schedule".
 *      No on/off switch: there is nothing yet to pause.
 *   B. Scheduled  (DB row, enabled=true)  — primary "Save changes"
 *      (enabled only when the form diverges from the row).
 *      Switch flips to Paused via an immediate server PUT.
 *      Remove is the destructive secondary.
 *   C. Paused     (DB row, enabled=false) — same as B, with the form
 *      visibly dimmed so the operator can scan the page and see what's
 *      live at a glance. Editing a paused row is fine; only the cron
 *      worker treats `enabled=false` as "don't fire".
 *
 * The server `Schedule` table is the single source of truth (one row per
 * tenantId+cadence, enforced by a unique index). localStorage only
 * buffers in-flight form edits across reloads.
 */

type ReportId = 'daily' | 'weekly' | 'monthly';

const RECIPIENTS_CAP = 6;

type ReportConfig = {
  id: ReportId;
  recipients: string[];
  time: string; // 24-hour HH:mm
  /** Weekly: 0=Sun..6=Sat. Monthly: 'last' or '1'..'28' or 'last-business'. */
  cadenceValue?: string;
};

type ServerSchedule = {
  id: number;
  tenantId: number;
  cadence: ReportId;
  dayOfWeek: number | null;
  dayOfMonth: string | null;
  timeLocal: string;
  timezone: string;
  recipients: string[];
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
};

type HighlightId =
  | 'bucket-change'
  | 'heat-band-change'
  | 'category-change'
  | 'new-anomaly'
  | 'paid-off'
  | 'new-rep';

type SchedulerState = {
  reports: Record<ReportId, ReportConfig>;
  highlights: Record<HighlightId, boolean>;
};

const STORAGE_KEY = 'vera-scheduler-v2';

const DEFAULT_STATE: SchedulerState = {
  reports: {
    daily: { id: 'daily', recipients: [], time: '08:00' },
    weekly: { id: 'weekly', recipients: [], time: '09:00', cadenceValue: '1' },
    monthly: {
      id: 'monthly',
      recipients: [],
      time: '17:00',
      cadenceValue: 'last',
    },
  },
  highlights: {
    'bucket-change': true,
    'heat-band-change': true,
    'category-change': true,
    'new-anomaly': true,
    'paid-off': true,
    'new-rep': true,
  },
};

const REPORT_META: Record<
  ReportId,
  { title: string; description: string }
> = {
  daily: {
    title: 'Daily AR brief',
    description:
      "Vera's morning rollup of past-terms jobs, anomalies, and reps to watch.",
  },
  weekly: {
    title: 'Weekly summary',
    description:
      "A wider snapshot of the week's AR movement — what shifted, what closed, what slipped.",
  },
  monthly: {
    title: 'Monthly close',
    description:
      'End-of-month rollup with the full job table, anomaly history, and per-rep accountability.',
  },
};

const HIGHLIGHT_META: Array<{ id: HighlightId; label: string; hint: string }> = [
  {
    id: 'bucket-change',
    label: 'Job moved between aging buckets',
    hint: "e.g. within-terms → 1–30 past, or 31–60 → 60+",
  },
  {
    id: 'heat-band-change',
    label: 'Heat score band changed',
    hint: 'cool / warm / hot / critical transitions',
  },
  {
    id: 'category-change',
    label: 'Job category changed',
    hint: 'Insurance ↔ retail, residential ↔ commercial',
  },
  {
    id: 'new-anomaly',
    label: 'New anomaly flagged',
    hint: 'Any of the nine anomaly rules tripping for the first time',
  },
  {
    id: 'paid-off',
    label: 'Job paid off',
    hint: 'Balance dropped to zero — the job left the AR set',
  },
  {
    id: 'new-rep',
    label: 'New rep assigned',
    hint: 'Ownership change since the last run',
  },
];

const DAY_OF_WEEK_OPTIONS = [
  { value: '1', label: 'Mondays' },
  { value: '2', label: 'Tuesdays' },
  { value: '3', label: 'Wednesdays' },
  { value: '4', label: 'Thursdays' },
  { value: '5', label: 'Fridays' },
  { value: '6', label: 'Saturdays' },
  { value: '0', label: 'Sundays' },
];

const DAY_OF_MONTH_OPTIONS = [
  { value: '1', label: '1st of the month' },
  { value: '15', label: '15th of the month' },
  { value: 'last-business', label: 'Last business day' },
  { value: 'last', label: 'Last day of the month' },
];

function migrateReport(
  base: ReportConfig,
  raw: Partial<ReportConfig> & { recipient?: string },
): ReportConfig {
  const recipients = Array.isArray(raw.recipients)
    ? raw.recipients.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : typeof raw.recipient === 'string' && raw.recipient.length > 0
      ? [raw.recipient]
      : base.recipients;
  return {
    ...base,
    ...raw,
    recipients,
  };
}

function loadState(): SchedulerState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      reports: {
        daily: migrateReport(DEFAULT_STATE.reports.daily, parsed.reports?.daily ?? {}),
        weekly: migrateReport(DEFAULT_STATE.reports.weekly, parsed.reports?.weekly ?? {}),
        monthly: migrateReport(DEFAULT_STATE.reports.monthly, parsed.reports?.monthly ?? {}),
      },
      highlights: { ...DEFAULT_STATE.highlights, ...(parsed.highlights ?? {}) },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state: SchedulerState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function recipientsValid(list: readonly string[]): boolean {
  if (list.length === 0) return false;
  if (list.length > RECIPIENTS_CAP) return false;
  return list.every(isValidEmail);
}

function recipientsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function summarizeRecipients(list: readonly string[]): string {
  if (list.length === 0) return 'no recipients';
  const [first, ...rest] = list;
  if (first === undefined) return 'no recipients';
  if (rest.length === 0) return first;
  if (list.length <= 3) return list.join(', ');
  return `${first} + ${rest.length} more`;
}

function reportFromServer(row: ServerSchedule): ReportConfig {
  return {
    id: row.cadence,
    recipients: row.recipients,
    time: row.timeLocal,
    cadenceValue:
      row.cadence === 'weekly'
        ? String(row.dayOfWeek ?? 1)
        : row.cadence === 'monthly'
          ? row.dayOfMonth ?? 'last'
          : undefined,
  };
}

/** True iff the user's form differs from the saved server row. */
function isDirty(form: ReportConfig, server: ServerSchedule): boolean {
  if (!recipientsEqual(form.recipients, server.recipients)) return true;
  if (form.time !== server.timeLocal) return true;
  if (form.id === 'weekly') {
    const serverDow = server.dayOfWeek === null ? null : String(server.dayOfWeek);
    if ((form.cadenceValue ?? null) !== serverDow) return true;
  }
  if (form.id === 'monthly') {
    if ((form.cadenceValue ?? null) !== (server.dayOfMonth ?? null)) return true;
  }
  return false;
}

type SendOutcome =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'success'; to: string[]; pdfBytes: number; id: string }
  | { kind: 'error'; message: string };

type ScheduleOutcome =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'saved'; nextRunAt: string }
  | { kind: 'paused' }
  | { kind: 'resumed'; nextRunAt: string }
  | { kind: 'removed' }
  | { kind: 'error'; message: string };

const SSR_FALLBACK_TIMEZONE = 'America/Chicago';

function resolveTimezone(): string {
  if (typeof window === 'undefined') return SSR_FALLBACK_TIMEZONE;
  return (
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? SSR_FALLBACK_TIMEZONE
  );
}

function tzAbbreviation(timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const part = fmt.formatToParts(new Date()).find((p) => p.type === 'timeZoneName');
    return part?.value ?? '';
  } catch {
    return '';
  }
}

export function SchedulerView() {
  const [state, setState] = useState<SchedulerState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [timezone, setTimezone] = useState(SSR_FALLBACK_TIMEZONE);
  // `false` until the first /api/schedules response lands. Drives the
  // skeleton rows below — without this we'd briefly render every row as
  // "Not scheduled" before the real server state swaps in.
  // See CLAUDE.md "Loading states: skeleton-first" for the convention.
  const [serverRowsLoaded, setServerRowsLoaded] = useState(false);
  // Server-known schedules. `null` means "no row" — that's state A for
  // that cadence. The form-vs-server diff drives every visible affordance.
  const [serverRows, setServerRows] = useState<Record<ReportId, ServerSchedule | null>>({
    daily: null,
    weekly: null,
    monthly: null,
  });
  const [outcomes, setOutcomes] = useState<Record<ReportId, SendOutcome>>({
    daily: { kind: 'idle' },
    weekly: { kind: 'idle' },
    monthly: { kind: 'idle' },
  });
  const [scheduleOutcomes, setScheduleOutcomes] = useState<
    Record<ReportId, ScheduleOutcome>
  >({
    daily: { kind: 'idle' },
    weekly: { kind: 'idle' },
    monthly: { kind: 'idle' },
  });
  const confirm = useConfirm();

  useEffect(() => {
    const local = loadState();
    setState(local);
    setTimezone(resolveTimezone());
    setHydrated(true);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/schedules', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { schedules: ServerSchedule[] };
        if (cancelled) return;
        const byCadence: Record<ReportId, ServerSchedule | null> = {
          daily: null,
          weekly: null,
          monthly: null,
        };
        for (const row of json.schedules) {
          if (row.cadence in byCadence) byCadence[row.cadence] = row;
        }
        setServerRows(byCadence);
        // For cadences that have a server row, server wins over localStorage.
        // For cadences without one, leave the local draft alone (user may
        // have been typing).
        setState((prev) => {
          const next = { ...prev, reports: { ...prev.reports } };
          for (const id of ['daily', 'weekly', 'monthly'] as ReportId[]) {
            const row = byCadence[id];
            if (row) next.reports[id] = reportFromServer(row);
          }
          saveState(next);
          return next;
        });
      } catch {
        /* network blip — leave the form on localStorage values */
      } finally {
        // Flip serverRowsLoaded once — drives the skeleton-off transition
        // for every cadence row. If the fetch failed entirely, we still
        // flip so the page doesn't sit on skeletons forever; the user
        // sees state A everywhere and can save fresh.
        if (!cancelled) setServerRowsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function update(next: SchedulerState) {
    setState(next);
    saveState(next);
  }

  function updateReport(id: ReportId, patch: Partial<ReportConfig>) {
    update({
      ...state,
      reports: {
        ...state.reports,
        [id]: { ...state.reports[id], ...patch },
      },
    });
  }

  function toggleHighlight(id: HighlightId, on: boolean) {
    update({
      ...state,
      highlights: { ...state.highlights, [id]: on },
    });
  }

  async function sendNow(id: ReportId) {
    const cfg = state.reports[id];
    const briefTitle = REPORT_META[id].title;
    if (!recipientsValid(cfg.recipients)) {
      toast.error(`Couldn't send the ${briefTitle}`, {
        description: 'Add at least one valid recipient first.',
      });
      return;
    }
    setOutcomes((o) => ({ ...o, [id]: { kind: 'pending' } }));
    try {
      const res = await fetch('/api/brief/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: cfg.recipients, cadence: id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOutcomes((o) => ({ ...o, [id]: { kind: 'idle' } }));
        toast.error(`Couldn't send the ${briefTitle}`, {
          description: json?.error?.message ?? 'Unknown error',
        });
        return;
      }
      const sentTo: string[] = Array.isArray(json.to) ? json.to : cfg.recipients;
      setOutcomes((o) => ({
        ...o,
        [id]: {
          kind: 'success',
          to: sentTo,
          pdfBytes: json.pdfBytes,
          id: json.id,
        },
      }));
      toast.success(`${briefTitle} sent`, {
        description: `Delivered to ${summarizeRecipients(sentTo)} · PDF ${(json.pdfBytes / 1024).toFixed(1)} KB`,
      });
    } catch (e) {
      setOutcomes((o) => ({ ...o, [id]: { kind: 'idle' } }));
      toast.error(`Couldn't send the ${briefTitle}`, {
        description: e instanceof Error ? e.message : 'Network error',
      });
    }
  }

  /**
   * Persist the form to the server. Creates the row in state A or rewrites
   * it in B/C. Always preserves the current `enabled` state — the switch
   * owns that flag, not the form.
   */
  async function saveSchedule(id: ReportId) {
    const cfg = state.reports[id];
    const briefTitle = REPORT_META[id].title;
    if (!recipientsValid(cfg.recipients)) {
      toast.error(`Couldn't save the ${briefTitle}`, {
        description: 'Add at least one valid recipient first.',
      });
      return;
    }

    const dayOfWeek =
      id === 'weekly' && cfg.cadenceValue !== undefined
        ? Number(cfg.cadenceValue)
        : null;
    const dayOfMonth = id === 'monthly' ? cfg.cadenceValue ?? null : null;
    const enabled = serverRows[id]?.enabled ?? true;

    setScheduleOutcomes((o) => ({ ...o, [id]: { kind: 'pending' } }));
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayOfWeek,
          dayOfMonth,
          timeLocal: cfg.time,
          timezone,
          recipients: cfg.recipients,
          enabled,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setScheduleOutcomes((o) => ({ ...o, [id]: { kind: 'idle' } }));
        toast.error(`Couldn't save the ${briefTitle}`, {
          description:
            typeof json?.error === 'string'
              ? json.error
              : `Save failed (HTTP ${res.status})`,
        });
        return;
      }
      const saved: ServerSchedule = json.schedule;
      setServerRows((rows) => ({ ...rows, [id]: saved }));
      setScheduleOutcomes((o) => ({
        ...o,
        [id]: { kind: 'saved', nextRunAt: saved.nextRunAt ?? '' },
      }));
      toast.success(`${briefTitle} scheduled`, {
        description: saved.nextRunAt
          ? `Next run ${formatNextRun(saved.nextRunAt, timezone)}`
          : undefined,
      });
    } catch (e) {
      setScheduleOutcomes((o) => ({ ...o, [id]: { kind: 'idle' } }));
      toast.error(`Couldn't save the ${briefTitle}`, {
        description: e instanceof Error ? e.message : 'Network error',
      });
    }
  }

  /**
   * Flip enabled on the existing server row. Optimistic: update the local
   * `serverRows` view immediately so the switch + pill move together; on
   * error, roll back and surface the message.
   */
  async function setEnabled(id: ReportId, nextEnabled: boolean) {
    const row = serverRows[id];
    if (!row) return; // Switch should not be visible in state A.
    const previous = row;
    const optimistic: ServerSchedule = { ...row, enabled: nextEnabled };
    setServerRows((rows) => ({ ...rows, [id]: optimistic }));
    setScheduleOutcomes((o) => ({ ...o, [id]: { kind: 'pending' } }));
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayOfWeek: row.dayOfWeek,
          dayOfMonth: row.dayOfMonth,
          timeLocal: row.timeLocal,
          timezone: row.timezone,
          recipients: row.recipients,
          enabled: nextEnabled,
        }),
      });
      const json = await res.json();
      const briefTitle = REPORT_META[id].title;
      if (!res.ok) {
        setServerRows((rows) => ({ ...rows, [id]: previous }));
        setScheduleOutcomes((o) => ({ ...o, [id]: { kind: 'idle' } }));
        toast.error(`Couldn't ${nextEnabled ? 'resume' : 'pause'} ${briefTitle}`, {
          description:
            typeof json?.error === 'string'
              ? json.error
              : `HTTP ${res.status}`,
        });
        return;
      }
      const saved: ServerSchedule = json.schedule;
      setServerRows((rows) => ({ ...rows, [id]: saved }));
      setScheduleOutcomes((o) => ({
        ...o,
        [id]: nextEnabled
          ? { kind: 'resumed', nextRunAt: saved.nextRunAt ?? '' }
          : { kind: 'paused' },
      }));
      toast.success(nextEnabled ? `${briefTitle} resumed` : `${briefTitle} paused`, {
        description:
          nextEnabled && saved.nextRunAt
            ? `Next run ${formatNextRun(saved.nextRunAt, timezone)}`
            : undefined,
      });
    } catch (e) {
      setServerRows((rows) => ({ ...rows, [id]: previous }));
      setScheduleOutcomes((o) => ({ ...o, [id]: { kind: 'idle' } }));
      toast.error(`Couldn't update ${REPORT_META[id].title}`, {
        description: e instanceof Error ? e.message : 'Network error',
      });
    }
  }

  async function removeSchedule(id: ReportId) {
    if (!serverRows[id]) return;
    const briefTitle = REPORT_META[id].title;
    const ok = await confirm({
      title: 'Remove this schedule',
      description: `Automatic sends will stop for the ${briefTitle}. You can still trigger one manually with Send now.`,
      confirmLabel: 'Remove schedule',
      destructive: true,
    });
    if (!ok) return;

    setScheduleOutcomes((o) => ({ ...o, [id]: { kind: 'pending' } }));
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setScheduleOutcomes((o) => ({ ...o, [id]: { kind: 'idle' } }));
        toast.error(`Couldn't remove ${briefTitle}`, {
          description:
            typeof json?.error === 'string'
              ? json.error
              : `HTTP ${res.status}`,
        });
        return;
      }
      setServerRows((rows) => ({ ...rows, [id]: null }));
      setScheduleOutcomes((o) => ({ ...o, [id]: { kind: 'removed' } }));
      toast.success(`${briefTitle} schedule removed`);
    } catch (e) {
      setScheduleOutcomes((o) => ({ ...o, [id]: { kind: 'idle' } }));
      toast.error(`Couldn't remove ${briefTitle}`, {
        description: e instanceof Error ? e.message : 'Network error',
      });
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10">

      {/* Header */}
      <header className="vera-rise space-y-3">
        <p className="text-text-muted text-xs tracking-[0.2em] uppercase">
          Configuration · scheduler
        </p>
        <h1 className="font-display text-4xl tracking-tight md:text-5xl">
          When Vera reports, and to whom.
        </h1>
        <p className="text-text-secondary max-w-2xl text-sm leading-relaxed">
          Pick the cadences you want, who they go to, and what counts as a
          highlight when something changes between runs. Each cadence is a
          single schedule — changing the recipient replaces the previous one,
          it doesn&apos;t add another.
        </p>
      </header>

      <Tabs defaultValue="reports" name="scheduler" className="vera-rise-delay-1 gap-6">
        <TabsList aria-label="Scheduler sections">
          <Tab value="reports">Reports</Tab>
          <Tab value="data-sync">Data sync</Tab>
        </TabsList>

        <TabsContent value="reports" className="space-y-4 pt-6">
          <p className="text-text-muted text-xs">3 cadences available</p>
          {(['daily', 'weekly', 'monthly'] as ReportId[]).map((id) =>
            serverRowsLoaded ? (
              <ReportRow
                key={id}
                report={state.reports[id]}
                serverRow={serverRows[id]}
                outcome={outcomes[id]}
                scheduleOutcome={scheduleOutcomes[id]}
                hydrated={hydrated}
                timezone={timezone}
                onChange={(patch) => updateReport(id, patch)}
                onSendNow={() => sendNow(id)}
                onSave={() => saveSchedule(id)}
                onToggleEnabled={(v) => setEnabled(id, v)}
                onRemove={() => removeSchedule(id)}
              />
            ) : (
              <ReportRowSkeleton key={id} cadence={id} />
            ),
          )}
        </TabsContent>

        <TabsContent value="data-sync" className="space-y-4 pt-6">
          <DataSyncSection />
        </TabsContent>
      </Tabs>

      {/*
        "What gets highlighted" section is hidden until the underlying
        highlight rule engine is implemented — today it's UI-only sugar with
        no effect on the actual email/PDF output. State + persistence remain
        in place so we can resurface it once the diff engine ships.
      */}
    </div>
  );
}

function ReportRow({
  report,
  serverRow,
  outcome,
  scheduleOutcome,
  hydrated,
  timezone,
  onChange,
  onSendNow,
  onSave,
  onToggleEnabled,
  onRemove,
}: {
  report: ReportConfig;
  serverRow: ServerSchedule | null;
  outcome: SendOutcome;
  scheduleOutcome: ScheduleOutcome;
  hydrated: boolean;
  timezone: string;
  onChange: (patch: Partial<ReportConfig>) => void;
  onSendNow: () => void;
  onSave: () => void;
  onToggleEnabled: (next: boolean) => void;
  onRemove: () => void;
}) {
  const meta = REPORT_META[report.id];
  const tzLabel = tzAbbreviation(timezone);
  const cadenceLine = describeCadence(report, tzLabel);
  const allRecipientsParse = report.recipients.every(isValidEmail);
  const hasRecipient = report.recipients.length > 0;
  const recipientsOk = hasRecipient && allRecipientsParse;

  // Status pill follows server state. State A = "Not scheduled"; otherwise
  // "Scheduled" or "Paused" depending on `enabled` on the row. The pill is
  // single-purpose: "what will the cron worker do right now?".
  let statusLabel: string;
  let statusActive: boolean;
  if (!serverRow) {
    statusLabel = 'Not scheduled';
    statusActive = false;
  } else if (serverRow.enabled) {
    statusLabel = 'Scheduled';
    statusActive = true;
  } else {
    statusLabel = 'Paused';
    statusActive = false;
  }

  const hasServerRow = serverRow !== null;
  const isPaused = hasServerRow && !serverRow.enabled;
  // Dimmed body for paused rows — at-a-glance signal that this isn't live.
  const dimBodyClass = isPaused ? 'opacity-60' : '';

  // Save-button enablement. State A: at least one valid recipient. State B/C:
  // only when the form has actually diverged from the server row.
  const dirty = serverRow ? isDirty(report, serverRow) : true;
  const saveDisabled =
    !recipientsOk ||
    scheduleOutcome.kind === 'pending' ||
    (hasServerRow && !dirty);

  const saveLabel = (() => {
    if (scheduleOutcome.kind === 'pending') {
      return hasServerRow ? 'Saving…' : 'Scheduling…';
    }
    return hasServerRow ? 'Save changes' : 'Schedule';
  })();

  return (
    <Card>
      <div className="space-y-5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-accent/10 text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg tracking-tight sm:text-xl">{meta.title}</h3>
                <span
                  className={
                    statusActive
                      ? 'border-accent/30 bg-accent/10 text-accent rounded-full border px-2 py-0.5 text-[0.65rem] tracking-[0.18em] uppercase'
                      : 'border-border bg-bg-base text-text-muted rounded-full border px-2 py-0.5 text-[0.65rem] tracking-[0.18em] uppercase'
                  }
                >
                  {statusLabel}
                </span>
              </div>
              <p className="text-text-secondary text-sm leading-relaxed">
                {meta.description}
              </p>
              {hydrated ? (
                <p className="text-text-muted text-xs">
                  <span className="tabular-nums">{cadenceLine}</span>
                </p>
              ) : null}
              {hydrated && serverRow ? (
                <ServerRunLine
                  nextRunAt={serverRow.nextRunAt}
                  lastRunAt={serverRow.lastRunAt}
                  timezone={timezone}
                  recipients={serverRow.recipients}
                />
              ) : null}
            </div>
          </div>

          {/* Switch only appears once there's something to pause. In state A
              it would be meaningless — there's no row yet. */}
          {hasServerRow ? (
            <div className="flex flex-col items-end gap-1">
              <Switch
                checked={serverRow.enabled}
                onCheckedChange={(v) => onToggleEnabled(v)}
                disabled={scheduleOutcome.kind === 'pending'}
                aria-label={
                  serverRow.enabled
                    ? `Pause ${meta.title}`
                    : `Resume ${meta.title}`
                }
              />
              <p className="text-text-muted max-w-[14rem] text-right text-[0.65rem] leading-tight">
                {serverRow.enabled
                  ? 'On — Vera will send on the schedule below.'
                  : 'Paused — no automatic sends. A dispatch already in flight may still complete.'}
              </p>
            </div>
          ) : null}
        </div>

        {/* Editable body. Dimmed when paused so an operator scanning the
            page can see at a glance what's live. */}
        <div className={`space-y-5 transition-opacity ${dimBodyClass}`}>
          {/* Cadence + time row — daily is single-column, weekly/monthly
              add the day-of-week / day-of-month picker so this is two
              columns. Recipients moved to its own row below so the chip
              input always gets full card width. */}
          <div
            className={`border-border bg-bg-base/40 grid grid-cols-1 gap-4 rounded-2xl border p-4 ${
              report.id === 'daily' ? '' : 'md:grid-cols-2'
            }`}
          >
            {report.id === 'weekly' ? (
              <Field label="Day of week">
                <ShadcnSelect
                  value={report.cadenceValue ?? '1'}
                  onChange={(v) => onChange({ cadenceValue: v })}
                  options={DAY_OF_WEEK_OPTIONS}
                  ariaLabel="Day of week"
                />
              </Field>
            ) : null}
            {report.id === 'monthly' ? (
              <Field label="Day of month">
                <ShadcnSelect
                  value={report.cadenceValue ?? 'last'}
                  onChange={(v) => onChange({ cadenceValue: v })}
                  options={DAY_OF_MONTH_OPTIONS}
                  ariaLabel="Day of month"
                />
              </Field>
            ) : null}

            <Field label="Time (your local time)">
              <TimePicker
                value={report.time}
                onChange={(v) => onChange({ time: v })}
                ariaLabel={`Time for ${REPORT_META[report.id].title}`}
              />
            </Field>
          </div>

          {/* Recipients row — full width so chips always have room to
              breathe, matching the Data sync section's notification block. */}
          <div className="border-border bg-bg-base/40 space-y-1.5 rounded-2xl border p-4">
            <label className="text-text-muted text-[0.65rem] tracking-[0.2em] uppercase">
              Recipients
            </label>
            <p className="text-text-secondary text-xs">
              Everyone listed here gets this brief when it sends.
            </p>
            <EmailChipInput
              value={report.recipients}
              onChange={(next) => onChange({ recipients: next })}
              max={RECIPIENTS_CAP}
              placeholder="gm@yourcompany.com"
              ariaLabel={`Recipients for ${meta.title}`}
            />
          </div>

          {/* Action row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* All transient feedback (sent / saved / paused / resumed /
                  removed / error) moved to toasts via the global <Toaster>.
                  See CLAUDE.md hard rule #11: no inline status banners. */}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {hasServerRow ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  disabled={scheduleOutcome.kind === 'pending'}
                  aria-label={`Remove ${meta.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="ml-1.5 whitespace-nowrap">Remove</span>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={onSave}
                disabled={saveDisabled}
              >
                <CalendarClock className="mr-2 h-3.5 w-3.5" />
                <span className="whitespace-nowrap">{saveLabel}</span>
              </Button>
              <Button
                type="button"
                onClick={onSendNow}
                disabled={!recipientsOk || outcome.kind === 'pending'}
              >
                {outcome.kind === 'pending' ? (
                  <span className="whitespace-nowrap">Sending…</span>
                ) : (
                  <>
                    <Send className="mr-2 h-3.5 w-3.5" />
                    <span className="whitespace-nowrap">Send now</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Show the server-known recipient + next/last run for this cadence. This
 * is the operator's check that what they think is scheduled is actually
 * what the cron worker will fire. Hidden until we know the row exists.
 */
function ServerRunLine({
  nextRunAt,
  lastRunAt,
  timezone,
  recipients,
}: {
  nextRunAt: string | null;
  lastRunAt: string | null;
  timezone: string;
  recipients: string[];
}) {
  return (
    <p className="text-text-muted text-xs">
      <span>
        To{' '}
        <strong className="text-text-secondary">
          {summarizeRecipients(recipients)}
        </strong>
      </span>
      {nextRunAt ? (
        <>
          <span className="mx-1.5">·</span>
          <span>Next {formatNextRun(nextRunAt, timezone)}</span>
        </>
      ) : null}
      {lastRunAt ? (
        <>
          <span className="mx-1.5">·</span>
          <span>Last {formatNextRun(lastRunAt, timezone)}</span>
        </>
      ) : null}
    </p>
  );
}

function formatNextRun(iso: string, timezone = resolveTimezone()): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
    timeZoneName: 'short',
  });
}

function Field({
  label,
  children,
  error,
  className,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  className?: string;
}) {
  return (
    <div className={'space-y-1.5 ' + (className ?? '')}>
      <label className="text-text-muted text-[0.65rem] tracking-[0.2em] uppercase">
        {label}
      </label>
      {children}
      {error ? (
        <p
          role="alert"
          className="text-heat-critical flex items-center gap-1.5 text-xs"
        >
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ShadcnSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function describeCadence(report: ReportConfig, tzLabel: string): string {
  const time = tzLabel
    ? `${formatTime12h(report.time)} ${tzLabel}`
    : formatTime12h(report.time);
  if (report.id === 'daily') return `Every weekday at ${time}`;
  if (report.id === 'weekly') {
    const day =
      DAY_OF_WEEK_OPTIONS.find((o) => o.value === report.cadenceValue)?.label ??
      'Mondays';
    return `${day} at ${time}`;
  }
  const day =
    DAY_OF_MONTH_OPTIONS.find((o) => o.value === report.cadenceValue)?.label ??
    'Last day of the month';
  return `${day} at ${time}`;
}

function formatTime12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h24 = parseInt(hStr ?? '0', 10);
  const m = parseInt(mStr ?? '0', 10);
  const meridiem = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${meridiem}`;
}

/**
 * Skeleton placeholder for a single cadence row, rendered while the
 * first /api/schedules response is in flight. Same Card chrome + same
 * vertical rhythm as the real ReportRow so the layout doesn't shift
 * when real data lands and the skeleton swaps out.
 *
 * Per CLAUDE.md "Loading states: skeleton-first" — we never render the
 * row's true content (status pill, recipient field, switch) against
 * default values during the loading window. The user sees shimmering
 * placeholders until the server tells us what the actual state is.
 */
function ReportRowSkeleton({ cadence }: { cadence: ReportId }) {
  const meta = REPORT_META[cadence];
  return (
    <Card>
      <div className="space-y-5">
        {/* Title row: icon + title + description, no real state yet. */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-bg-base flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg tracking-tight sm:text-xl">
                  {meta.title}
                </h3>
                <Skeleton className="h-4 w-20 rounded-full" />
              </div>
              <p className="text-text-secondary text-sm leading-relaxed">
                {meta.description}
              </p>
              <SkeletonText width="w-64" />
            </div>
          </div>
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>

        {/* Cadence + time row — matches the new two-column layout for
            weekly/monthly, single column for daily. Skeletons keep the
            two-column shape so the layout doesn't shift on hydrate. */}
        <div
          className={`border-border bg-bg-base/40 grid grid-cols-1 gap-4 rounded-2xl border p-4 ${
            cadence === 'daily' ? '' : 'md:grid-cols-2'
          }`}
        >
          {cadence !== 'daily' ? (
            <div className="space-y-1.5">
              <SkeletonText width="w-20" className="h-2" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <SkeletonText width="w-16" className="h-2" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>

        {/* Recipients row — full width, mirroring the real component. */}
        <div className="border-border bg-bg-base/40 space-y-1.5 rounded-2xl border p-4">
          <SkeletonText width="w-20" className="h-2" />
          <SkeletonText width="w-64" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>

        {/* Action row — three skeleton buttons. */}
        <div className="flex items-center justify-end gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
      </div>
    </Card>
  );
}
