# Vera MVP — Vercel Deployment

## Architecture

Turborepo monorepo on Vercel. Each app in `apps/*` is its own Vercel project. Today there's only `apps/web`, so we have **one** Vercel project named `vera-mvp` with **Root Directory = `apps/web`**. If we ever add `apps/api` or `apps/marketing`, each gets its own Vercel project.

## What's already prepared (Phase 0 done)

- ✅ `apps/web/data/generated.json` (~150 KB) untracked from `.gitignore` and committed. Vercel reads it directly — no preprocess needed at build time.
- ✅ The 188 MB `data/jobs_dedup.jsonl` source remains gitignored.
- ✅ Latest commit on `main` (`b2dbb75` + this prep commit) builds clean and passes 44/44 Playwright specs.

## What you do (~5 minutes)

1. **Sign in to Vercel**
   ```bash
   vercel login
   ```
   Or sign in at vercel.com.

2. **Create the project**
   - vercel.com/new → **Import Git Repository** → pick `adityauphade-mac/vera-mvp`.
   - **Project Name:** `vera-mvp`
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** click **Edit** → set to `apps/web` (this is the key setting)
   - **Build & Output:** leave defaults — Vercel detects:
     - Install Command: `pnpm install` (auto, since `packageManager: pnpm@10.33.3` is in root `package.json`)
     - Build Command: `next build`
     - Output Directory: `.next`
   - Don't deploy yet — set the env var first.

3. **Add the OpenAI key**
   - Project → **Settings** → **Environment Variables**
   - Key: `OPENAI_API_KEY`
   - Value: paste your `sk-proj-...` key
   - Environments: check **Production** (and **Preview** if you want PRs to have a working chat)
   - Save.

4. **Deploy**
   - Back to the Project dashboard → **Deployments** → if the import already triggered a build with no key, click **Redeploy** on the latest. Otherwise hit **Deploy**.
   - Build runtime: ~2–3 minutes (Next.js 16 + Tailwind 4 + workspace install).

5. **Smoke test** the live URL Vercel hands you (`vera-mvp-xxxxx.vercel.app`):
   - `/` — landing renders with all sections
   - `/dashboard` — donut + metric tiles + Today's Briefing load
   - `/dashboard/aging` — table renders, click any row → JobDetailSheet
   - Open chat → ask "who's worst this week?" → real OpenAI response

## After the first deploy

- **Auto-deploy is on** — every push to `main` triggers a production deploy, every PR gets a preview URL.
- **Branch protection** — optional. Settings → Git → Production Branch.
- **Vercel Analytics / Speed Insights** — optional.
- **Custom domain** — skipped for now per the brief.

## What can go wrong (and quick fixes)

| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails on `Cannot find module @vera/ui` | Vercel didn't pick up the workspace | Check Project → Settings → General → Root Directory is `apps/web` (not `./`) |
| Build fails with `data/generated.json: ENOENT` | The committed JSON didn't push, or `apps/web/data/` is being ignored | `git ls-files apps/web/data/generated.json` — should print the path |
| `/api/chat` returns 500 in production | `OPENAI_API_KEY` not set in Production env | Step 3 again, then Redeploy |
| Cards are flush against borders / Tailwind utilities missing | `@source` in `globals.css` not picking up `shared/ui` | Already fixed at `b2dbb75` — no action needed |
| Out-of-memory during build | Next.js 16 + Tailwind 4 on default 8 GB | Add `NODE_OPTIONS=--max-old-space-size=4096` to env |

## Refreshing the data later

When the RoofLink export is updated:

1. Drop the new JSONL at `data/jobs_dedup.jsonl` locally.
2. Run `pnpm preprocess` — regenerates `apps/web/data/generated.json` (~150 KB).
3. `git add apps/web/data/generated.json && git commit -m "data: refresh AR snapshot"`
4. `git push` — Vercel auto-deploys with the new data.

## Future apps in the monorepo

When you add `apps/api` or `apps/marketing`:

1. New Vercel project, e.g. `vera-api`.
2. Root Directory = `apps/api`.
3. Vercel detects the framework (Next.js, Hono, Express, etc.) and installs from the workspace root automatically.
4. Each app gets its own URL, env vars, and deploy lifecycle.
