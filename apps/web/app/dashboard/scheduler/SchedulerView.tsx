'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CalendarClock, CheckCircle2, Send } from 'lucide-react';
import {
  Button,
  Card,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  TimePicker,
  Tooltip,
} from '@vera/ui';

/**
 * Scheduler — recurring report delivery configuration.
 *
 * One-shot Send now goes through /api/brief/send → Resend immediately.
 * Recurring "Schedule" goes to /api/schedules, which persists a Schedule
 * row keyed on tenantId + cadence. A GitHub Actions workflow hits the
 * /api/cron/dispatch-briefs endpoint every 15 min, which finds rows whose
 * nextRunAt has passed, fires the email, and advances nextRunAt to the
 * next slot. Per-row UI state (enabled/recipient/time) lives in
 * localStorage so the form remembers itself across sessions.
 */

type ReportId = 'daily' | 'weekly' | 'monthly';

type ReportConfig = {
  id: ReportId;
  enabled: boolean;
  recipient: string;
  time: string; // 24-hour HH:mm
  /** Weekly: 0=Sun..6=Sat. Monthly: 'last' or '1'..'28'. */
  cadenceValue?: string;
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

const STORAGE_KEY = 'vera-scheduler-v1';

const DEFAULT_STATE: SchedulerState = {
  reports: {
    daily: {
      id: 'daily',
      enabled: true,
      recipient: '',
      time: '08:00',
    },
    weekly: {
      id: 'weekly',
      enabled: false,
      recipient: '',
      time: '09:00',
      cadenceValue: '1', // Monday
    },
    monthly: {
      id: 'monthly',
      enabled: false,
      recipient: '',
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
  { title: string; description: string; cadenceLabel: string }
> = {
  daily: {
    title: 'Daily AR brief',
    description:
      "Vera's morning rollup of past-terms jobs, anomalies, and reps to watch.",
    cadenceLabel: 'Every weekday',
  },
  weekly: {
    title: 'Weekly summary',
    description:
      "A wider snapshot of the week's AR movement — what shifted, what closed, what slipped.",
    cadenceLabel: 'Once a week',
  },
  monthly: {
    title: 'Monthly close',
    description:
      'End-of-month rollup with the full job table, anomaly history, and per-rep accountability.',
    cadenceLabel: 'Once a month',
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

function loadState(): SchedulerState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      reports: {
        daily: { ...DEFAULT_STATE.reports.daily, ...(parsed.reports?.daily ?? {}) },
        weekly: { ...DEFAULT_STATE.reports.weekly, ...(parsed.reports?.weekly ?? {}) },
        monthly: {
          ...DEFAULT_STATE.reports.monthly,
          ...(parsed.reports?.monthly ?? {}),
        },
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

type SendOutcome =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'success'; to: string; pdfBytes: number; id: string }
  | { kind: 'error'; message: string };

type ScheduleOutcome =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'saved'; nextRunAt: string }
  | { kind: 'error'; message: string };

// Use the operator's browser timezone so the time they pick fires at THAT
// time on their device. SSR can't read window — fall back to UTC at render
// time and re-resolve on the client. We also fall back to America/Chicago
// (Priority Roofs Dallas) if Intl is unavailable, but every modern browser
// supports it.
const SSR_FALLBACK_TIMEZONE = 'America/Chicago';

function resolveTimezone(): string {
  if (typeof window === 'undefined') return SSR_FALLBACK_TIMEZONE;
  return (
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? SSR_FALLBACK_TIMEZONE
  );
}

/** Short tz abbreviation for the given IANA name, e.g. "IST", "CDT". */
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
  // Operator's browser timezone — falls back to Chicago on SSR and updates
  // after hydration. We pass this through to ReportRow so describeCadence
  // and formatNextRun are timezone-stable across SSR↔CSR (no hydration
  // mismatch warnings).
  const [timezone, setTimezone] = useState(SSR_FALLBACK_TIMEZONE);
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

  // Hydrate from localStorage + resolve browser tz after first render to
  // avoid SSR mismatch.
  useEffect(() => {
    setState(loadState());
    setTimezone(resolveTimezone());
    setHydrated(true);
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
    if (!isValidEmail(cfg.recipient)) {
      setOutcomes((o) => ({
        ...o,
        [id]: { kind: 'error', message: 'Enter a valid recipient email first.' },
      }));
      return;
    }
    setOutcomes((o) => ({ ...o, [id]: { kind: 'pending' } }));
    try {
      const res = await fetch('/api/brief/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: cfg.recipient, cadence: id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOutcomes((o) => ({
          ...o,
          [id]: { kind: 'error', message: json?.error?.message ?? 'Send failed.' },
        }));
        return;
      }
      setOutcomes((o) => ({
        ...o,
        [id]: {
          kind: 'success',
          to: json.to,
          pdfBytes: json.pdfBytes,
          id: json.id,
        },
      }));
    } catch (e) {
      setOutcomes((o) => ({
        ...o,
        [id]: {
          kind: 'error',
          message:
            e instanceof Error
              ? e.message
              : 'Network error — could not reach the server.',
        },
      }));
    }
  }

  async function scheduleNow(id: ReportId) {
    const cfg = state.reports[id];
    if (!isValidEmail(cfg.recipient)) {
      setScheduleOutcomes((o) => ({
        ...o,
        [id]: { kind: 'error', message: 'Enter a valid recipient email first.' },
      }));
      return;
    }

    // Map the UI cadenceValue to the API shape. For weekly cadence the value
    // is a day-of-week (0-6); for monthly it's '1'..'28' or 'last'.
    const dayOfWeek =
      id === 'weekly' && cfg.cadenceValue !== undefined
        ? Number(cfg.cadenceValue)
        : null;
    const dayOfMonth = id === 'monthly' ? cfg.cadenceValue ?? null : null;

    setScheduleOutcomes((o) => ({ ...o, [id]: { kind: 'pending' } }));
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cadence: id,
          dayOfWeek,
          dayOfMonth,
          timeLocal: cfg.time,
          timezone,
          recipient: cfg.recipient,
          enabled: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setScheduleOutcomes((o) => ({
          ...o,
          [id]: {
            kind: 'error',
            message: json?.error ?? `Schedule failed (HTTP ${res.status}).`,
          },
        }));
        return;
      }
      setScheduleOutcomes((o) => ({
        ...o,
        [id]: { kind: 'saved', nextRunAt: json.schedule.nextRunAt },
      }));
    } catch (e) {
      setScheduleOutcomes((o) => ({
        ...o,
        [id]: {
          kind: 'error',
          message:
            e instanceof Error
              ? e.message
              : 'Network error — could not reach the server.',
        },
      }));
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {/* Cron reliability advisory — see notes in OPERATIONS.md. */}
      <div
        role="status"
        className="border-heat-warm/40 bg-heat-warm/5 vera-rise flex items-start gap-3 rounded-2xl border px-5 py-4"
      >
        <AlertTriangle className="text-heat-warm mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-1">
          <p className="text-text-primary text-sm font-medium">
            Automatic dispatch may be delayed
          </p>
          <p className="text-text-secondary text-xs leading-relaxed">
            We rely on GitHub Actions cron for recurring sends. New
            workflows can sit in a multi-hour onboarding throttle before the
            first auto-fire. Scheduled rows here will queue and send the
            moment GitHub picks them up. For guaranteed immediate delivery,
            use <strong>Send now</strong>.
          </p>
        </div>
      </div>

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
          highlight when something changes between runs. Each row remembers
          its setting in your browser.
        </p>
      </header>

      {/* Reports */}
      <section className="vera-rise-delay-1 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-text-secondary text-sm tracking-[0.2em] uppercase">
            Reports
          </h2>
          <p className="text-text-muted text-xs">3 cadences available</p>
        </div>

        <ReportRow
          report={state.reports.daily}
          outcome={outcomes.daily}
          scheduleOutcome={scheduleOutcomes.daily}
          hydrated={hydrated}
          timezone={timezone}
          onChange={(patch) => updateReport('daily', patch)}
          onSendNow={() => sendNow('daily')}
          onSchedule={() => scheduleNow('daily')}
        />
        <ReportRow
          report={state.reports.weekly}
          outcome={outcomes.weekly}
          scheduleOutcome={scheduleOutcomes.weekly}
          hydrated={hydrated}
          timezone={timezone}
          onChange={(patch) => updateReport('weekly', patch)}
          onSendNow={() => sendNow('weekly')}
          onSchedule={() => scheduleNow('weekly')}
        />
        <ReportRow
          report={state.reports.monthly}
          outcome={outcomes.monthly}
          scheduleOutcome={scheduleOutcomes.monthly}
          hydrated={hydrated}
          timezone={timezone}
          onChange={(patch) => updateReport('monthly', patch)}
          onSendNow={() => sendNow('monthly')}
          onSchedule={() => scheduleNow('monthly')}
        />
      </section>

      {/* Highlights */}
      <section className="vera-rise-delay-2 space-y-4">
        <div className="space-y-1">
          <h2 className="text-text-secondary text-sm tracking-[0.2em] uppercase">
            What gets highlighted
          </h2>
          <p className="text-text-muted text-xs">
            When a report runs, these are the changes since the last run that
            Vera will call out at the top of the email and PDF.
          </p>
        </div>

        <Card>
          <div className="divide-border divide-y">
            {HIGHLIGHT_META.map((h) => {
              const checked = state.highlights[h.id] ?? false;
              return (
                <div
                  key={h.id}
                  className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                >
                  <div className="space-y-0.5">
                    <p className="text-text-primary text-sm font-medium">
                      {h.label}
                    </p>
                    <p className="text-text-muted text-xs">{h.hint}</p>
                  </div>
                  <Switch
                    checked={checked}
                    onCheckedChange={(v) => toggleHighlight(h.id, v)}
                    aria-label={`Toggle highlight: ${h.label}`}
                  />
                </div>
              );
            })}
          </div>
        </Card>
      </section>
    </div>
  );
}

function ReportRow({
  report,
  outcome,
  scheduleOutcome,
  hydrated,
  timezone,
  onChange,
  onSendNow,
  onSchedule,
}: {
  report: ReportConfig;
  outcome: SendOutcome;
  scheduleOutcome: ScheduleOutcome;
  hydrated: boolean;
  timezone: string;
  onChange: (patch: Partial<ReportConfig>) => void;
  onSendNow: () => void;
  onSchedule: () => void;
}) {
  const meta = REPORT_META[report.id];
  const tzLabel = tzAbbreviation(timezone);
  const cadenceLine = describeCadence(report, tzLabel);
  // When the row's switch is off, the recurring-schedule fields and the
  // Schedule button lock. Send Now stays enabled because it doesn't read
  // those fields — it sends with the current recipient and cadence
  // immediately. Recipient stays editable so an ad-hoc Send Now still
  // works.
  const locked = !report.enabled;
  const recipientValid = report.recipient ? isValidEmail(report.recipient) : true;

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
                    report.enabled
                      ? 'border-accent/30 bg-accent/10 text-accent rounded-full border px-2 py-0.5 text-[0.65rem] tracking-[0.18em] uppercase'
                      : 'border-border bg-bg-base text-text-muted rounded-full border px-2 py-0.5 text-[0.65rem] tracking-[0.18em] uppercase'
                  }
                >
                  {report.enabled ? 'Active' : 'Paused'}
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
            </div>
          </div>
          <Switch
            checked={report.enabled}
            onCheckedChange={(v) => onChange({ enabled: v })}
            aria-label={`Toggle ${meta.title}`}
          />
        </div>

        {/* Config row */}
        <div className="border-border bg-bg-base/40 grid grid-cols-1 gap-4 rounded-2xl border p-4 md:grid-cols-3">
          {report.id === 'weekly' ? (
            <Field label="Day of week">
              <LockedHint locked={locked}>
                <ShadcnSelect
                  value={report.cadenceValue ?? '1'}
                  onChange={(v) => onChange({ cadenceValue: v })}
                  options={DAY_OF_WEEK_OPTIONS}
                  ariaLabel="Day of week"
                  disabled={locked}
                />
              </LockedHint>
            </Field>
          ) : null}
          {report.id === 'monthly' ? (
            <Field label="Day of month">
              <LockedHint locked={locked}>
                <ShadcnSelect
                  value={report.cadenceValue ?? 'last'}
                  onChange={(v) => onChange({ cadenceValue: v })}
                  options={DAY_OF_MONTH_OPTIONS}
                  ariaLabel="Day of month"
                  disabled={locked}
                />
              </LockedHint>
            </Field>
          ) : null}

          <Field label="Time (your local time)">
            <LockedHint locked={locked}>
              <TimePicker
                value={report.time}
                onChange={(v) => onChange({ time: v })}
                ariaLabel={`Time for ${REPORT_META[report.id].title}`}
                disabled={locked}
              />
            </LockedHint>
          </Field>

          <Field
            label="Recipient"
            className={report.id === 'daily' ? 'md:col-span-2' : ''}
            error={
              report.recipient && !recipientValid
                ? 'Enter a valid email address'
                : undefined
            }
          >
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="gm@yourcompany.com"
              value={report.recipient}
              onChange={(e) => onChange({ recipient: e.target.value })}
              className={
                report.recipient && !recipientValid
                  ? 'border-heat-critical focus:border-heat-critical bg-bg-card text-text-primary placeholder:text-text-muted w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors'
                  : 'border-border focus:border-accent bg-bg-card text-text-primary placeholder:text-text-muted w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors'
              }
            />
          </Field>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            {outcome.kind === 'success' ? (
              <div className="border-accent/30 bg-accent/5 flex items-center gap-2 rounded-xl border px-3 py-2">
                <CheckCircle2 className="text-accent h-3.5 w-3.5 shrink-0" />
                <p className="text-text-primary text-xs">
                  Sent to <strong>{outcome.to}</strong> · PDF{' '}
                  {(outcome.pdfBytes / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : null}
            {outcome.kind === 'error' ? (
              <div className="border-heat-critical/40 bg-heat-critical/5 flex items-center gap-2 rounded-xl border px-3 py-2">
                <AlertCircle className="text-heat-critical h-3.5 w-3.5 shrink-0" />
                <p className="text-text-primary text-xs">{outcome.message}</p>
              </div>
            ) : null}
            {scheduleOutcome.kind === 'saved' ? (
              <div className="border-accent/30 bg-accent/5 flex items-center gap-2 rounded-xl border px-3 py-2">
                <CheckCircle2 className="text-accent h-3.5 w-3.5 shrink-0" />
                <p className="text-text-primary text-xs">
                  Scheduled — next run{' '}
                  <strong>{formatNextRun(scheduleOutcome.nextRunAt, timezone)}</strong>.
                </p>
              </div>
            ) : null}
            {scheduleOutcome.kind === 'error' ? (
              <div className="border-heat-critical/40 bg-heat-critical/5 flex items-center gap-2 rounded-xl border px-3 py-2">
                <AlertCircle className="text-heat-critical h-3.5 w-3.5 shrink-0" />
                <p className="text-text-primary text-xs">{scheduleOutcome.message}</p>
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LockedHint locked={locked}>
              <Button
                type="button"
                variant="secondary"
                onClick={onSchedule}
                disabled={
                  locked ||
                  !report.recipient ||
                  !recipientValid ||
                  scheduleOutcome.kind === 'pending'
                }
              >
                <CalendarClock className="mr-2 h-3.5 w-3.5" />
                <span className="whitespace-nowrap">
                  {scheduleOutcome.kind === 'pending' ? 'Scheduling…' : 'Schedule'}
                </span>
              </Button>
            </LockedHint>
            <Button
              type="button"
              onClick={onSendNow}
              disabled={
                !report.recipient ||
                !recipientValid ||
                outcome.kind === 'pending'
              }
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
    </Card>
  );
}

// Format the next-run timestamp in the tenant's timezone (Chicago) so the
// toast matches what the user picked, regardless of where the operator's
// browser is. Locale-formatted abbreviation ("CDT" / "CST") tells them which
// tz they're looking at.
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

/**
 * Shows a tooltip explaining why an input is locked when the row's
 * enabled-switch is off. Disabled HTML elements don't fire pointer
 * events, so the wrapper `<span>` is the hover target — same trick the
 * Radix docs recommend for tooltipped-but-disabled buttons.
 *
 * When `locked` is false this is a passthrough — no tooltip rendered, no
 * extra DOM noise.
 */
function LockedHint({
  locked,
  children,
}: {
  locked: boolean;
  children: React.ReactNode;
}) {
  if (!locked) return <>{children}</>;
  return (
    <Tooltip
      content="Enable this row above to schedule. Send now still works while paused."
      side="top"
      block
      triggerClassName="cursor-not-allowed"
    >
      {children}
    </Tooltip>
  );
}

function ShadcnSelect({
  value,
  onChange,
  options,
  ariaLabel,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
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
  // The time is the operator's local time. Append the resolved tz
  // abbreviation (IST / CDT / etc) so the cadence line reads naturally.
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
