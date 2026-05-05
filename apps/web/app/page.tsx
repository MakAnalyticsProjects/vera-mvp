import Link from 'next/link';
import {
  AlertTriangle,
  ClipboardCheck,
  GaugeCircle,
  ListChecks,
  MessageCircle,
  Trophy,
  X,
} from 'lucide-react';
import { Button, VeraQuote } from '@vera/ui';

const FEATURES = [
  {
    icon: AlertTriangle,
    cadence: 'Daily',
    title: 'Aging & anomalies',
    body: "I bucket every unpaid invoice by how late it is, relative to the customer's terms. Then I flag the patterns that worry me — math that doesn't add up, paperwork stuck, work archived but still owing.",
  },
  {
    icon: ListChecks,
    cadence: 'Daily',
    title: 'Milestone tracking',
    body: "For every install, I cross-reference against the certificate of completion, the final check, and the commission request. Whichever ones are missing, I hang as a tag — that's the leak.",
  },
  {
    icon: GaugeCircle,
    cadence: 'Daily',
    title: 'Rep follow-ups',
    body: 'I score every job from 0–100 and surface a draft email for the rep to send. Anything that crosses 76 jumps onto the executive review queue. I never send mail myself; you stay in control.',
  },
  {
    icon: Trophy,
    cadence: 'Weekly',
    title: 'Rep outstanding',
    body: "A leaderboard, sorted however you want — by dollars, by count, by oldest age, by average heat. I'll write a digest you can copy and forward.",
  },
  {
    icon: ClipboardCheck,
    cadence: 'Weekly',
    title: 'Reconciliation',
    body: "I sweep every completed install and ask: is anyone working this? If the answer is no — no recent paperwork, no edit, no commission — I flag it as 'fell through cracks.'",
  },
  {
    icon: MessageCircle,
    cadence: 'Always',
    title: 'Chat',
    body: "Ask me anything inside my AR remit. Who's worst this week? Why is this job critical? Draft me a follow-up for McMackin. I'll show my work.",
  },
];

const ASSUMPTIONS = [
  {
    code: 'Q1',
    title: "A job is in AR only if it's been installed and still owes money.",
    body: 'Anything earlier in the pipeline is a sales question, not an AR one. Of 103,440 records in RoofLink, that filter leaves about 130 — and those are the ones I watch.',
  },
  {
    code: 'Q3',
    title: 'Net 30 for retail. Net 60 for insurance.',
    body: 'Insurance depreciation checks legitimately take 30–90 days post-install. One blanket rule misrepresents both sides.',
  },
  {
    code: 'Q4',
    title: 'Aging buckets are relative to terms, not the calendar.',
    body: 'A 50-day-old insurance job is on time, not late. Buckets read "within terms," "1–30 past," "31–60 past," "60+ past."',
  },
  {
    code: 'Q7',
    title: 'Every escalation shows its math.',
    body: 'Heat score is days past terms (40%) + balance (25%) + rep silence (20%) + anomaly count (15%). Hover any badge and you\'ll see exactly why the number is what it is.',
  },
  {
    code: 'Q9',
    title: 'I draft. You send.',
    body: 'No live emails go out from my account. Every nudge is a draft you can review, edit, and copy. Trust before autonomy.',
  },
];

const OUT_OF_SCOPE = [
  'QuickBooks sync (no QB export was provided)',
  'Real outbound email — drafts only',
  'Per-rep logins — exec view only',
  'Trend reports, departed-rep audits, end-of-month close',
  'Edits back to RoofLink — Vera is read-only',
  'Mobile layouts — desktop dashboard first',
];

export default function Landing() {
  return (
    <main className="bg-bg-base min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        {/* Hero */}
        <section className="space-y-6 vera-rise">
          <p className="text-text-muted text-xs tracking-[0.2em] uppercase">
            Vera Calloway · Lead AR Intelligence Specialist
          </p>
          <h1 className="font-display text-5xl leading-[1.05] font-medium tracking-tight md:text-7xl">
            I keep an eye on the money <br className="hidden md:block" />
            that hasn&apos;t come home yet.
          </h1>
          <p className="text-text-secondary max-w-2xl text-lg leading-relaxed">
            A thoughtful companion for accounts receivable in the roofing business. I watch
            every install, notice when payment is sitting somewhere it shouldn&apos;t, and
            quietly draft the follow-ups before you ask.
          </p>
          <div className="flex flex-wrap gap-3 pt-4">
            <Link href="/dashboard">
              <Button size="lg">Open the dashboard →</Button>
            </Link>
            <Link href="/dashboard/design">
              <Button size="lg" variant="secondary">
                See the design system
              </Button>
            </Link>
          </div>
        </section>

        {/* What I do */}
        <section className="mt-28 vera-rise-delay-1">
          <h2 className="text-text-secondary mb-8 text-sm tracking-[0.2em] uppercase">
            What I do, every morning
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </section>

        {/* How I think */}
        <section className="mt-28 grid grid-cols-1 gap-12 md:grid-cols-[2fr_3fr] vera-rise-delay-2">
          <div>
            <h2 className="text-text-secondary mb-3 text-sm tracking-[0.2em] uppercase">
              How I think
            </h2>
            <p className="font-display text-4xl leading-tight font-medium tracking-tight">
              Default carefully.
              <br />
              Show your work.
            </p>
          </div>
          <ol className="space-y-7">
            {ASSUMPTIONS.map((a) => (
              <Assumption key={a.code} {...a} />
            ))}
          </ol>
        </section>

        {/* What 'AR' means */}
        <section className="mt-28">
          <h2 className="text-text-secondary mb-6 text-sm tracking-[0.2em] uppercase">
            What &apos;AR&apos; actually means
          </h2>
          <div className="bg-bg-card border-border rounded-[var(--radius-card)] border p-8">
            <p className="text-text-primary text-lg leading-relaxed">
              <span className="font-semibold">AR — Accounts Receivable</span> — is the
              accounting term for money customers owe you that you haven&apos;t collected yet.
            </p>
            <p className="text-text-secondary mt-4 leading-relaxed">
              When a roofing company finishes a $15,000 job and the customer hasn&apos;t paid
              (or only paid part), that unpaid amount sits as AR until it&apos;s either
              collected or written off. Every dollar in AR is a dollar you&apos;ve already
              spent — materials, labor, commission — but haven&apos;t recovered. So AR is
              cash-flow risk: companies can be profitable on paper and still go broke if
              AR balloons.
            </p>
            <p className="text-text-secondary mt-4 leading-relaxed">
              Of 103,440 records in your RoofLink export, only{' '}
              <span className="text-text-primary font-medium">130 jobs</span> meet the strict
              definition I use: the roof is on the house{' '}
              <em>and</em> there&apos;s still money owed. Those 130 are what I watch every
              morning.
            </p>
          </div>
        </section>

        {/* Net 30 vs Net 60 */}
        <section className="mt-16">
          <h2 className="text-text-secondary mb-6 text-sm tracking-[0.2em] uppercase">
            Payment terms — Net 30 vs Net 60
          </h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
            <div className="space-y-4">
              <p className="font-display text-text-primary text-3xl leading-tight font-medium tracking-tight">
                How long does the customer have to pay?
              </p>
              <p className="text-text-secondary leading-relaxed">
                Different jobs follow different timelines. A retail homeowner pays within
                30 days. An insurance carrier&apos;s depreciation check legitimately takes
                30–90 days. So I split the rule:
              </p>
              <ul className="text-text-secondary space-y-2 text-sm">
                <li>
                  <span className="text-text-primary font-medium">Net 30</span> for retail
                  / cash jobs
                </li>
                <li>
                  <span className="text-text-primary font-medium">Net 60</span> for
                  insurance jobs
                </li>
              </ul>
              <p className="text-text-muted text-sm leading-relaxed">
                Both clocks start at the install date. &apos;Within terms&apos; just means
                the clock hasn&apos;t expired yet.
              </p>
            </div>

            <div className="bg-bg-card border-border overflow-hidden rounded-[var(--radius-card)] border">
              <table className="w-full text-sm">
                <thead className="bg-bg-subtle text-text-secondary text-[0.65rem] tracking-[0.15em] uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Job type</th>
                    <th className="px-4 py-3 text-left font-semibold">Installed</th>
                    <th className="px-4 py-3 text-right font-semibold">Days past</th>
                    <th className="px-4 py-3 text-left font-semibold">Bucket</th>
                  </tr>
                </thead>
                <tbody>
                  <NetRow type="Retail" days={25} terms={30} bucket="Within terms" />
                  <NetRow type="Retail" days={40} terms={30} bucket="1–30 past" />
                  <NetRow type="Retail" days={95} terms={30} bucket="60+ past" />
                  <NetRow type="Insurance" days={50} terms={60} bucket="Within terms" />
                  <NetRow type="Insurance" days={75} terms={60} bucket="1–30 past" />
                  <NetRow type="Insurance" days={130} terms={60} bucket="60+ past" />
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* How heat works */}
        <section className="mt-28">
          <h2 className="text-text-secondary mb-8 text-sm tracking-[0.2em] uppercase">
            How heat works
          </h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_4fr]">
            <div className="space-y-4">
              <p className="font-display text-text-primary text-3xl leading-tight font-medium tracking-tight">
                A 0–100 score on every AR job.
              </p>
              <p className="text-text-secondary leading-relaxed">
                Every job earns a heat score from four ingredients I weigh:
              </p>
              <ul className="text-text-secondary space-y-2 text-sm leading-relaxed">
                <li>
                  <span className="text-text-primary font-medium">Days past terms</span> · 40%
                  — capped at 60+ days
                </li>
                <li>
                  <span className="text-text-primary font-medium">Balance size</span> · 25% —
                  log-scaled so $1k feels different from $50k
                </li>
                <li>
                  <span className="text-text-primary font-medium">Rep silence</span> · 20% —
                  growing if no one has touched the record in 14+ days
                </li>
                <li>
                  <span className="text-text-primary font-medium">Anomaly flags</span> · 15% —
                  one anomaly is a hint, three is a pattern
                </li>
              </ul>
              <p className="text-text-muted pt-2 text-sm">
                Hover any heat meter on the dashboard to see the four numbers behind a job&apos;s score.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <HeatBandCard
                band="Cool"
                range="0–25"
                meaning="On track. Fresh installs with paperwork moving. I won't bother you about these."
                color="var(--color-heat-cool)"
              />
              <HeatBandCard
                band="Warm"
                range="26–50"
                meaning="Visible but not nudged yet. The rep should know they exist; I'm keeping watch."
                color="var(--color-heat-warm)"
              />
              <HeatBandCard
                band="Hot"
                range="51–75"
                meaning="I'll draft a follow-up email for the rep today. Past terms + balance + something off."
                color="var(--color-heat-hot)"
              />
              <HeatBandCard
                band="Critical"
                range="76+"
                meaning="Auto-flows to the Executive Review Queue. Needs a personal touch, not just a rep nudge."
                color="var(--color-heat-critical)"
              />
            </div>
          </div>
        </section>

        {/* How each report works */}
        <section className="mt-28">
          <h2 className="text-text-secondary mb-8 text-sm tracking-[0.2em] uppercase">
            How each report works
          </h2>
          <div className="space-y-6">
            <ReportExplainer
              icon={AlertTriangle}
              cadence="Daily"
              title="Aging & anomalies"
              question="How late are my unpaid invoices, and is anything weird?"
              summary="Every AR job sorted by how far past terms. Plus a panel of strange patterns Vera flagged this morning — math errors, paperwork stuck, work archived but still owing."
              tiles={[
                { label: 'Within terms', meaning: "The customer's payment clock hasn't run out yet. Net 30 retail / Net 60 insurance, from install date." },
                { label: '1–30 past', meaning: 'Jobs 1–30 days past terms. First nudge territory.' },
                { label: '31–60 past', meaning: 'Jobs 31–60 days past terms. Escalation territory.' },
                { label: '60+ past', meaning: 'Jobs more than 60 days past terms. Likely needs executive intervention.' },
              ]}
            />

            <ReportExplainer
              icon={ListChecks}
              cadence="Daily"
              title="Milestone tracking"
              question="Which jobs are stuck because the paperwork hasn't moved?"
              summary="Cross-references every install against three milestones: certificate of completion, final (insurance depreciation) check, and commission request. Missing ones become tags on the row — that's where the money is stuck."
              tiles={[
                { label: 'Missing cert of completion', meaning: 'Install done, but no certificate of completion logged after 14 days. The insurer cannot release the final check without this document.' },
                { label: 'Insurance — final check open', meaning: 'Insurance jobs where the depreciation/RCV check hasn\'t been endorsed yet. The bigger of the two insurance payments.' },
                { label: 'No commission requested', meaning: "Rep hasn't requested commission after 14 days. Often a behavioral signal that the rep believes the job won't collect." },
                { label: 'Paperwork current', meaning: 'Jobs with all milestones logged. Nothing for me to chase.' },
              ]}
            />

            <ReportExplainer
              icon={GaugeCircle}
              cadence="Daily"
              title="Follow-ups & escalation"
              question="Who do I need to nudge today?"
              summary="Two queues for two audiences. Hot jobs (heat 51–75) get a draft email I write for the rep — they chase the customer. Critical jobs (76+) skip the rep entirely and go to the executive review queue — they need a personal touch from you."
              tiles={[
                { label: 'Hot — for reps', meaning: 'Heat 51–75. I draft the follow-up; the rep sends. The rep is still the right person to chase this.' },
                { label: 'Critical — exec review', meaning: 'Heat 76+. Too far gone for a rep nudge. Personal touch from the office: call the homeowner, write off, or use as a learning moment.' },
                { label: 'Total in heat', meaning: 'Hot + Critical combined. Cool / Warm jobs stay visible elsewhere but don\'t need follow-up today.' },
                { label: 'Total dollars in heat', meaning: 'Sum of balances across Hot and Critical. The dollar exposure on jobs that need active follow-up today.' },
              ]}
            />

            <ReportExplainer
              icon={Trophy}
              cadence="Weekly"
              title="Rep outstanding"
              question="Which rep is sitting on the most uncollected money?"
              summary="A leaderboard of every rep with at least one open job. Sortable four ways — dollars, count, oldest aging, or average heat. Filter by region or job type to slice it. Use it for one-on-ones, weekly stand-ups, or to spot patterns (one office consistently lagging, one rep always at the top)."
              tiles={[
                { label: 'Reps with AR', meaning: 'Number of distinct reps owning at least one AR job. Drops if you filter by region or job type.' },
                { label: 'Total outstanding', meaning: 'Sum of outstanding balances across the reps shown. Equals the dashboard\'s Total AR when no filters applied.' },
                { label: 'Worst single rep', meaning: 'The largest single-rep outstanding balance — the rep at the top of the leaderboard.' },
                { label: 'Average per rep', meaning: 'Total ÷ rep count. Reps significantly above this stand out.' },
              ]}
            />

            <ReportExplainer
              icon={ClipboardCheck}
              cadence="Weekly"
              title="Reconciliation — fell through cracks"
              question="Are any completed installs being totally ignored?"
              summary={"Once a week I walk every completed install and ask: is anyone actually working on this? I look for any sign of life in the last 14 days — an endorsed insurance check, a certificate of completion, a commission request, or even just a record edit. If none of those exist, the job has fallen through cracks. Aging shows what's late; reconciliation shows what's forgotten."}
              tiles={[
                { label: 'Stuck jobs', meaning: 'Jobs with zero recent activity across all four signals. The forgotten list.' },
                { label: 'Locked up', meaning: 'Total dollars in stuck jobs. Revenue already worked (materials + labor + commission paid out) but not actively being collected.' },
                { label: 'Reps affected', meaning: 'Distinct reps with at least one stuck job. High = systemic; low = concentrated.' },
                { label: 'Oldest install', meaning: 'Days since the oldest stuck install. Past 12 months, recovery rates drop sharply.' },
              ]}
            />
          </div>
        </section>

        {/* Vera quote */}
        <section className="mt-24 vera-rise-delay-3">
          <VeraQuote>
            Good morning. I&apos;m watching three jobs more closely than usual today —
            Mike Ahrend&apos;s McMackin install crossed into the Hot band overnight, and
            Brandon Roberts has two cert-of-completion gaps I&apos;d clear before lunch.
          </VeraQuote>
        </section>

        {/* Out of scope */}
        <section className="mt-24">
          <h2 className="text-text-secondary mb-5 text-sm tracking-[0.2em] uppercase">
            What this MVP doesn&apos;t do
          </h2>
          <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {OUT_OF_SCOPE.map((item) => (
              <li
                key={item}
                className="text-text-secondary flex items-start gap-2.5 text-sm leading-relaxed"
              >
                <span
                  className="bg-text-muted/15 text-text-muted mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                  aria-hidden="true"
                >
                  <X className="h-2.5 w-2.5" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <footer className="text-text-muted border-border mt-32 border-t pt-8 text-xs">
          Vera MVP · built around Priority Roofs export, May 2026.
        </footer>
      </div>
    </main>
  );
}

function FeatureCard({
  icon: Icon,
  cadence,
  title,
  body,
}: {
  icon: typeof AlertTriangle;
  cadence: string;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-bg-card border-border flex h-full flex-col rounded-[var(--radius-card)] border p-7 transition-shadow hover:shadow-[0_4px_16px_-6px_rgba(31,27,22,0.08)]">
      <div className="flex items-center gap-3">
        <span
          className="bg-accent/10 text-accent inline-flex h-8 w-8 items-center justify-center rounded-full"
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="bg-accent/10 text-accent rounded-full px-2.5 py-1 text-[0.6rem] font-medium tracking-[0.18em] uppercase">
          {cadence}
        </span>
      </div>
      <h3 className="font-display mt-5 text-2xl font-medium tracking-tight">{title}</h3>
      <p className="text-text-secondary mt-3 flex-1 text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function NetRow({
  type,
  days,
  terms,
  bucket,
}: {
  type: string;
  days: number;
  terms: number;
  bucket: string;
}) {
  const past = Math.max(0, days - terms);
  return (
    <tr className="border-border last:border-b-0 border-b">
      <td className="px-4 py-3">
        <span className="text-text-primary font-medium">{type}</span>
        <span className="text-text-muted ml-2 text-xs">Net {terms}</span>
      </td>
      <td className="text-text-secondary px-4 py-3">{days} days ago</td>
      <td className="px-4 py-3 text-right tabular-nums">
        {past === 0 ? <span className="text-text-muted">—</span> : <span>{past}</span>}
      </td>
      <td className="px-4 py-3">
        <span
          className={
            bucket === 'Within terms'
              ? 'text-text-muted'
              : bucket === '60+ past'
                ? 'text-heat-critical font-medium'
                : 'text-heat-warm font-medium'
          }
        >
          {bucket}
        </span>
      </td>
    </tr>
  );
}

function ReportExplainer({
  icon: Icon,
  cadence,
  title,
  question,
  summary,
  tiles,
}: {
  icon: typeof AlertTriangle;
  cadence: string;
  title: string;
  question: string;
  summary: string;
  tiles: Array<{ label: string; meaning: string }>;
}) {
  return (
    <div className="bg-bg-card border-border rounded-[var(--radius-card)] border p-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr_3fr]">
        <div>
          <div className="flex items-center gap-3">
            <span
              className="bg-accent/10 text-accent inline-flex h-8 w-8 items-center justify-center rounded-full"
              aria-hidden="true"
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="bg-accent/10 text-accent rounded-full px-2.5 py-1 text-[0.6rem] font-medium tracking-[0.18em] uppercase">
              {cadence}
            </span>
          </div>
          <h3 className="font-display mt-5 text-2xl font-medium tracking-tight">{title}</h3>
          <p className="text-accent mt-3 text-sm font-medium italic">{question}</p>
          <p className="text-text-secondary mt-4 leading-relaxed">{summary}</p>
        </div>
        <div className="space-y-3">
          <p className="text-text-muted text-[0.65rem] tracking-[0.2em] uppercase">
            What each tile shows
          </p>
          <ul className="border-border divide-border divide-y border-y">
            {tiles.map((t) => (
              <li key={t.label} className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 py-3">
                <span className="text-text-primary text-sm font-medium whitespace-nowrap">
                  {t.label}
                </span>
                <span className="text-text-secondary text-sm leading-relaxed">{t.meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function HeatBandCard({
  band,
  range,
  meaning,
  color,
}: {
  band: string;
  range: string;
  meaning: string;
  color: string;
}) {
  return (
    <div className="bg-bg-card border-border rounded-[var(--radius-card)] border p-5">
      <div className="flex items-center gap-3">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <p className="font-display text-text-primary text-lg font-medium tracking-tight">
          {band}
        </p>
        <span className="text-text-muted ml-auto text-xs tabular-nums">{range}</span>
      </div>
      <p className="text-text-secondary mt-2 text-sm leading-relaxed">{meaning}</p>
    </div>
  );
}

function Assumption({
  code,
  title,
  body,
}: {
  code: string;
  title: string;
  body: string;
}) {
  return (
    <li className="grid grid-cols-[auto_1fr] items-baseline gap-x-4">
      <span className="bg-accent/10 text-accent rounded-full px-2.5 py-1 text-[0.65rem] font-semibold tracking-[0.15em] uppercase tabular-nums">
        {code}
      </span>
      <div className="space-y-1.5">
        <p className="font-display text-text-primary text-lg leading-snug font-medium">
          {title}
        </p>
        <p className="text-text-secondary text-sm leading-relaxed">{body}</p>
      </div>
    </li>
  );
}
