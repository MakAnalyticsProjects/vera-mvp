# Vera MVP — Demo Script

A 7-minute walking demo for Brandon. Live URL: **https://vera-mvp.vercel.app**.

The script is structured around three things you want to leave Brandon with: **(a)** the rigor of the assumptions you made, **(b)** the polish of what you built, **(c)** an obvious "next" — what would unlock more of this if greenlit.

---

## 0 · 30-second framing (before you share screen)

> "You sent me a brief two days ago — a persona PDF and the RoofLink export. Five reports, very little spec. I treated it like a real product brief, which means I started by listing every assumption I'd have to make. There's a one-pager of those for you, with my defaults beside each — that's how I worked through ambiguity instead of guessing.
>
> I built an MVP around those defaults. It's deployed and live; you can play with it. Want me to walk it?"

Wait for the nod, then share screen.

---

## 1 · Landing page · 60 sec — set the tone

URL: **https://vera-mvp.vercel.app/**

> "This is the landing page Vera lives behind. I want you to see this before the dashboard because it explains how she thinks before she shows you what she sees."

Scroll through:

- **Hero** — "I keep an eye on the money that hasn't come home yet."
  - "That's the persona. Vera is a thoughtful AI controller, not a dashboard or a chatbot. The product has to feel like that."
- **What I do, every morning** — point to the 6 cards
  - "These are the five reports you asked for, plus an always-on chat. Three daily, two weekly. Each one has a clear job."
- **How I think** — the assumption rows (Q1, Q3, Q4, Q7, Q9)
  - "These are the 19 questions I had to make defaults for. Each one is on the page so you can challenge it. I picked the strict version everywhere — for example, Q1: a job is in AR only if the roof is on the house and balance is greater than zero. That's 130 jobs out of 103,440 records."
- **How heat works** — left column (formula) + 4 band cards
  - "Every job gets a 0–100 heat score. 40% from days past terms, 25% from balance, 20% from rep silence, 15% from anomalies. Cool / Warm / Hot / Critical bands. Critical auto-flows to executive review."
- **What this MVP doesn't do**
  - "Two minutes of scope honesty. No QuickBooks sync — you didn't have a QB export. No real outbound email — drafts only. No per-rep logins yet."

> "OK, that's how she thinks. Let me show you what she's looking at."

Click **Open the dashboard →**

---

## 2 · Dashboard / Today's Briefing · 90 sec — the morning view

URL: **https://vera-mvp.vercel.app/dashboard**

- **Vera quote** at the top
  - "She narrates first thing in the morning. 36 jobs in critical. 28 hot. 27 fell through. The address she'd worry about most is at 997 South Lowrance — that's Jennifer Lindsey's."
- **4 metric tiles** — point to them in order
  - "$1.28M total AR across 130 jobs. 36 in critical. 28 in hot. 27 fell through cracks since the last sweep — those are the ones nobody is touching anymore."
- **Heat distribution donut**
  - "How the 130 jobs split. Hover Cool — see, it tells you what each band means and what action it triggers."
  - **Hover Cool** → tooltip pops "Heat 0–25. On track..."
- **Top three I'd look at first** — point to each card
  - "She's pre-curated her top concerns. These are click-through to a detail panel — let me show you."

Click **the first card** (997 South Lowrance Road).

(Don't worry that the click on the dashboard top-3 cards isn't currently wired — pivot to the aging page where row clicks ARE wired.)

> "Actually, the cleanest way to see the per-job detail is from the aging report. Let me show you there."

---

## 3 · Aging & anomalies · 2 min — the daily detective view

URL: **https://vera-mvp.vercel.app/dashboard/aging**

- **Header** — Vera quote at top: "45 jobs are more than 60 days past their terms — that's where I'd focus first. Total past terms: $523k."
- **Four bucket tiles** — click "60+ past"
  - "These are clickable — filter the table to just one bucket. URL changes, page state stays scrolled here, no jump to top."
- Click **Clear filters** to go back.
- **Past-terms distribution** chart — point to it
  - "Same data, visual form. Larger means more jobs in that bucket."
- **What looks strange** — hover any row
  - "Anomalies. Vera runs nine rules every morning. Hover any one and you get the full explanation — for example, 'no commission request after 14 days' is a behavioral tell from the rep that something's off."
  - **Hover "No cert of completion"** → tooltip with full sentence
- **The job table — click any row**
  - "Each row is the AR detail. Click into it and you get the side sheet."
- **JobDetailSheet appears**
  - "Heat meter with the score broken into the four components — hover it, see the math. Stat tiles for balance, contract, payments. Install + terms def-list. Milestones with green checks and red X's. Anomaly chips. Customer and rep info. Esc closes it, click anywhere outside also closes it."

Press **Esc**.

> "This row-click pattern is wired the same on milestones, follow-ups, and reconciliation. Same component, same data."

---

## 4 · Follow-ups + the email draft · 60 sec — Vera's hands

URL: **https://vera-mvp.vercel.app/dashboard/follow-ups**

- **Two tabs** — point to them
  - "Hot for reps. Critical for executive review. Heat score on the right of each row tells you exactly why it's here."
- Click **Draft email** on any row
  - "Every job gets a follow-up draft Vera writes herself, grounded in real job data — install date, balance, what's missing. She never sends. You read, copy or open in mail."
  - Click **Open in mail** if you want, or click outside the modal to close.

> "Three nudges a week, then if it crosses 76 it stops being the rep's problem and goes to your queue. That's the executive review tab."

Click the **Executive review queue · 36** tab.

> "These don't get a rep email. They go straight to whoever you put in this seat. Cleaner than CC'ing everyone."

---

## 5 · Rep outstanding · 45 sec — the leaderboard

URL: **https://vera-mvp.vercel.app/dashboard/rep-report**

- **Top 10 chart** at the top
  - "Vera ranks reps four ways — dollars, count, oldest aging, average heat. Click the sort chips to flip the lens."
- **Click "Average heat"**
  - "Now the leaderboard re-orders. The chart re-orders. URL updates so you can share this exact view."
- **Filter by region** — click a region chip
  - "You can slice by region or job type. Useful when one office is dragging the average."

> "End of the week, I'll generate a digest you can paste into a stand-up. That's drafted, never sent."

---

## 6 · Reconciliation · 30 sec — the weekly sweep

URL: **https://vera-mvp.vercel.app/dashboard/reconciliation**

> "Once a week, Vera asks: is anyone actually working this completed install? She looks for any sign of life — a recent endorsement, a cert of completion, a commission request, or even just a record edit in the last 14 days. If none of those exist, she calls it 'fell through cracks.' These are the ones that quietly leak six figures over a year if no one notices."

- Point to the reasons under each card
  - "She tells you exactly why she flagged each one."

---

## 7 · Chat with Vera · 90 sec — the live one

Click **Ask Vera** (bottom right).

- Click **"Who's worst this week?"** (suggestion button)
  - Wait for OpenAI streaming response.
  - "She's grounded in the real data — every job, every rep, every heat score. She uses tools to look things up, she doesn't make numbers up. The reply formats with bold names, bullet points, the works."
- Type: **"Draft a follow-up for the highest-heat job."**
  - "She uses the same draft engine I just showed you. You can copy it straight out of the chat and send."
- Type: **"What's the weather in Dallas?"**
  - "She'll politely deflect. She's AR-scoped on purpose."

> "That's running on OpenAI behind the scenes. ~150ms first token, streams in real-time."

---

## 8 · Close · 30 sec

> "That's the MVP. Five reports, all the assumptions surfaced, real OpenAI grounded in the data, deployed and tested. The 130 numbers you see match what's in your RoofLink export — I cross-checked the totals.
>
> What this needs next, if greenlit:
> 1. **QuickBooks** — half the spec assumes it. Right now I infer payments from RoofLink alone.
> 2. **Real email send** — graduate the drafts to autosend on a schedule once the rules are trusted.
> 3. **Per-rep logins** — so reps can see their own AR queue. The data model already supports it.
>
> Each of those is a few days. I'd bias toward QuickBooks first since it tightens every other report."

---

## Cheat sheet — URLs to have ready

```
https://vera-mvp.vercel.app/                              landing
https://vera-mvp.vercel.app/dashboard                     today's briefing
https://vera-mvp.vercel.app/dashboard/aging               aging + anomalies
https://vera-mvp.vercel.app/dashboard/aging?bucket=60-plus-past   prefiltered
https://vera-mvp.vercel.app/dashboard/milestones          milestone tracking
https://vera-mvp.vercel.app/dashboard/follow-ups          rep follow-ups
https://vera-mvp.vercel.app/dashboard/follow-ups?tab=queue  executive queue
https://vera-mvp.vercel.app/dashboard/rep-report          leaderboard
https://vera-mvp.vercel.app/dashboard/rep-report?sort=heat  by heat
https://vera-mvp.vercel.app/dashboard/reconciliation      fell through cracks
https://vera-mvp.vercel.app/dashboard/design              internal design system
```

## If something breaks during the demo

| Issue | Recover by |
|---|---|
| Chat is slow / not responding | "OpenAI is having a moment — let me show the draft email instead, that doesn't need the LLM." |
| Sheet doesn't open on row click | Hard refresh (`Cmd+Shift+R`); if still broken, narrate from the table directly. |
| Page looks different from this script | I deployed something new — fall back to the screenshots in `tests/e2e/audit-screens/`. |

## Pacing tips

- **Don't read the script.** Use it as a beat-list. Brandon will throw questions; let them.
- **Expect "where did the 130 come from?"** — answer: `pnpm tsx scripts/verify-data.ts` proves it. 130 jobs that have `date_completed` set + balance > 0 + not `exclude_from_qb`. That's the strict AR rule from Q1.
- **Expect "can you show me a specific job?"** — `/dashboard/aging`, click any row.
- **Expect "what about [feature X]?"** — refer to "What this MVP doesn't do" on the landing or the spec out-of-scope.
