# Git Pulse — Project Plan (Hack Club Terra)

> **Status: PLAN ONLY.** This document defines everything needed to start Week 1 without further discussion. No product code is written yet.

---

## 1. Product Spec

### One-liner
Git Pulse turns any raw GitHub repository URL into an engaging, portfolio-ready **case study + health report** in seconds — a shareable page that looks great on a resume, generated automatically.

### Sanity-check vs. the Terra goal
Terra rewards **consistent, visible shipping across 12 weeks** (≥10 hrs/week, one shipped artifact per week is ideal). Git Pulse is a *good fit* for this because:
- It has a **narrow, self-contained core** that can be shipped fully in Week 1–2 (paste URL → get a report), satisfying "ship something real early".
- It has **natural weekly extension points** (each new report section / feature = a clean week-2/3-sized milestone) — no need to invent filler work.
- It produces **demonstrable, screenshot-able output** every week, which is exactly what reviewers want to see.

**Verdict: keep the idea, but narrow it.** Competing ideas (leaderboard/racing angle, org-wide multi-repo comparison) are bigger bets with weaker "why now" and are deferred — see §2 "Deferred".

### Core user flow (v1)
1. User pastes a public GitHub repo URL (e.g. `https://github.com/vercel/next.js`).
2. Client validates the URL and calls the app's `/api/analyze` endpoint.
3. App shows a **live progress stepper** ("Fetching commits… Analyzing deps… Writing summary…") so it doesn't feel like a black box.
4. App returns a **permanent, shareable URL** for the report, e.g. `/r/{owner}/{repo}`.
5. User shares that link or screenshots it for a portfolio.

### What the output contains (v1 report sections)
| Section | Source | Notes |
|---|---|---|
| Hero summary (2–3 sentence "elevator pitch") | Gemini (LLM) | Written for a portfolio audience, not README regurgitation |
| Tech stack + languages breakdown | GitHub API (languages) | Bar/pie visual |
| Dependencies count/table (by ecosystem) | GitHub API (contents) | Parse manifest files (package.json/requirements.txt/Cargo.toml/go.mod) |
| Commit activity graph (last 90 days) | GitHub API (commits) | Weekly commit counts |
| Contributor count + contributor rotation | GitHub API | Simple derived stats |
| Repo "vital signs" score (0–100) | GitHub API + deterministic heuristic | Composite of stars, forks, recency of commits, test presence, license presence |
| Basic security/dependency check | Static heuristic (no API key) | Flags: no license, missing README, leaked-looking file names, outdated-manifest signals |
| Folder-structure tree | GitHub API (`git/trees?recursive=1`) | Collapsible, clickable |

**Explicitly out of scope for v1:** private-repo support, auth-protected org dashboards, deep file-level code review, and competitive leaderboard (see §2).

### Deferred / Alternatives considered (do not build now)
- **Leaderboard / racing angle:** fun but requires a public gamified score that invites "gaming" and is much harder to make meaningfully fair across languages/repo types. Park it — could become a bonus feature in Week 10+ only if the core ships early.
- **Org/multi-repo comparison:** bigger data-fetch scope, harder rate-limit math, weaker portfolio angle. Not worth it for a 12-week solo build.
- The **AI-output-quality focus** variant (fewer stats, deeper written narrative per repo) is *more* differentiated in the long run but harder to demo-progress weekly. Keep Git Pulse's stats+AI mix; it's the best "ship something every week" cadence.

---

## 2. 12-Week Roadmap

Each week **must end in something demonstrably shipped** (deployed demo or new deployed feature). This is sized so real work genuinely fills 10+ hrs/week — generous early, harder later.

- **Week 1 — Working skeleton, deployed.** Set up Next.js project, deploy the empty-but-working app (URL → `/api/analyze` → JSON output) end-to-end. Ship = deployed page that turns a repo URL into JSON stat dump.
- **Week 2 — Full v1 report, deployed.** Wire GitHub API + deterministic (no-LLM) analysis into the pipeline; render the full report UI (every section above except the LLM-written hero) into a shareable page. Ship = public shareable report page for any repo.
- **Week 3 — Add Gemini AI-written sections.** Integrate Gemini API to write the hero summary + one AI insight block. Ship = AI section live in deployed report.
- **Week 4 — URLs are permanent + nicer (report page design pass).** Make `/r/{owner}/{repo}` URLs deterministic/cached; polish report page design (typography, layout, OG-image preview). Ship = polished, OG-image-previewable share URL.
- **Week 5 — Commit activity + contributor visuals.** Build weekly commit heatmap/graph and contributor stats; also ship a proper "progress" UX (stepper) for long analyses. Ship = deployed visuals + progress stepper.
- **Week 6 — Health score engine.** Ship the 0–100 composite "vital signs" score with published rubric (checks documented in-repo), broken down per pillar. Ship = score + per-check detail page.
- **Week 7 — Security check pass.** Ship the static security/dependency hygiene pass (license, README, suspicious filenames, manifest staleness). Ship = security section in deployed report.
- **Week 8 — Searchable report index + per-week changelog.** Ship a public "recently analyzed" index and a `/changelog` page that reflects every week's shipped artifacts, mirroring Terra's weekly shipping requirement. Ship = index + changelog.
- **Week 9 — Comparison view (2 repos side-by-side).** Add "compare this repo vs. that repo" on the report page. Big lift: needs 2 parallel fetch pipelines. Ship = deployed comparison view.
- **Week 10 — Public API for the report JSON.** Ship `GET /api/report?owner=&repo=&fmt=json` so others can build on the tool. Ship = docs page + working public endpoint.
- **Week 11 — Big-model upgrade pass.** Switch/enhance LLM sections using a better model or a better rubric, plus A/B-style polish on prompt/response format. Ship = measured, before/after quality notes shipped in the changelog.
- **Week 12 — Timeline of all 12 weeks shipped.** Build the "Terra/v13" hero page showing every week's artifacts and hours logged across the whole project, as a capstone "proof of work" page. Ship = the capstone page itself.

**Deferred to post-challenge:** leaderboard/competitive angle; org-wide dashboard.

---

## 3. Technical Approach

### Stack recommendation
- **Framework:** Next.js (App Router, TypeScript) — fits the "API routes + static-ish pages in one deploy" shape that fits great with the workflow we'll use. Alternative considered: plain Vite + a tiny Cloudflare Worker; Next.js is more standard and gives the quickest path from weekly idea → deployed feature.
- **Styling:** Tailwind CSS v4 + shadcn-style components (copy-in, not a heavy framework). Avoids design rabbit holes.
- **Hosting:** Vercel (free tier fits this, and auto-deploy from GitHub is a natural fit for "every week ships = every week has a deploy").
- **Language:** TypeScript throughout.

### GitHub API integration
- **Auth:** use a fine-grained **personal access token (PAT)** stored as an env var (server-side only, never client-side). This raises the rate limit from 60 to 5,000 req/hr.
- **Primary endpoints:**
  - `GET /repos/{owner}/{repo}` — metadata
  - `GET /repos/{owner}/{repo}/languages` — language/byte breakdown
  - `GET /repos/{owner}/{repo}/commits` — paginated (100/repo, capped at ~2 pages = 200 commits) for activity graphs
  - `GET / repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1` — file tree (capped depth)
  - `GET /repos/{owner}/{repo}/contents/{path}` — read manifests (package.json etc.)
- **Respect rate limits:** implement in-memory cache keyed on repo SHA, plus strict pagination caps. Log remaining-request headers to monitor.

### Gemini integration
- Use the **Gemini REST API** (`generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` or legacy `gemini-1.5-flash`) via plain `fetch` in a server route — no SDK needed.
- **Prompt structure:** send ONLY repo metadata + stats (never raw file contents beyond small manifests) and ask for a fixed JSON shape so the UI stays deterministic even if the model changes.
- **Fallback if no key:** every AI section has a **deterministic template fallback** (e.g. "A {language} project with {n} deps, {stars} stars, active in the last {days} days") so the deployed product works with zero keys configured (matters for the API key risk below).

### Hosting/deployment
- **Vercel** on the free tier, connected to this repo, with preview deploys per branch + production deploy per merge to main.
- Env vars needed on Vercel: `GITHUB_TOKEN` (optional but recommended), `GEMINI_API_KEY` (optional for Week 3+). **No other paid services.**

### What can be built without paid API keys
- The whole deterministic pipeline (GitHub with unauthenticated 60/hr rate limit — enough for demos; Gemini template fallback) — tightening this is explicitly Week 2.
- Always keep the app fully functional with no keys; keys just add quality.

---

## 4. Terra Mechanics — documenting the weekly hours

Goal: make the shipped-hours trail **auditable and habit-friendly**.

- **Repository = the time trail.** Every work session results in a real commit; the one-liner format for commit messages is standard: `Wk{n}: {what shipped}` (e.g. `Wk3: Gemini hero summary sections`). The `Wk{n}` prefix makes the 12-week progress obvious at a glance in the commit history.
- **PLAN.md stays in the repo** so reviewers see the plan vs. what shipped.
- **Capstone page (Week 12) doubles as a proof-of-work portfolio** — links every weekly shipped artifact.
- **Habit/checkpoint routine:**
  - **Daily:** commit every working session with the `Wk{n}:` prefix. Small commits count — they show cadence and are the raw material for hours.
  - **Weekly (per Terra week):** merge to `main` → deploys to Vercel → **write the week's section in `CHANGELOG.md`**: what shipped, deploy URL, hours logged (~10+), screenshots.
  - **End of each Terra week:** update the Terra farm (plant/water/sell) as soon as hours are logged, not after — makes the farming loop part of the ritual, not a chore after shipping.
- **Fallback if Vercel account/key is unavailable in a week:** ship the feature to the repo and a Netlify/GitHub Pages static fallback for the report page, so no week stalls on deployment infra.

---

## 5. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **GitHub API rate limits (60/hr unauthenticated)** | Analysis fails past a handful of tests | Retry/aggressive in-memory caching; get a PAT early (Week 1) to unlock 5,000/hr. |
| **Gemini key not ready** (Week 3+) | AI sections missing / shipped feature incomplete | Every AI section has a deterministic template fallback (see §3) — a week never stalls on API access. |
| **Scope creep** ("wouldn't it be cool if…") | Weeks slip, fewer shipped artifacts | Week scope is frozen by this doc. New ideas go to the **Deferred** list in §2, only promoted if a week finishes early. |
| **Vercel/Hosing-outage mid-week** | Weekly deploy may be late | Feature is committed first; deploy can lag; report only needs the repo to demonstrate the week (screenshots in CHANGELOG.md). |
| **Commit-history ambiguity** | Reviewers can't tell what shipped when | `Wk{n}:` prefix + weekly CHANGELOG.md entries + deploy URLs — all verifiably time-stamped by git. |
| **Private/fork/empty repos** fail analysis | Demo embarrassment in screenshots | Week 2 adds graceful error page + analysis-on-empty-repo edge case handling. |
| **"AI-audit" claims (security section) overreach** | App gets dunked on for claiming security guarantees | Copy strategy: security section is explicitly **"hygiene checks"** not "vulnerability audit" — wording in §1 is deliberate. |

---

## 6. Week 1 checklist (start here next session)

1. `npx create-next-app@latest . --typescript --tailwind --eslint --app`(inside this repo, keep `PLAN.md` in place + directories clean).
2. Push scaffold; first commit message: `Wk1: project scaffold + PLAN.md`.
3. Re-set the Vercel project (or use Netlify/GH Pages fallback if unavailable) and deploy the scaffold.
4. Build `/api/analyze` route: given `owner/repo`, return `{ repo, stars, languages, lastCommitDaysAgo }` JSON with unauthenticated GitHub API + in-memory cache.
5. Build minimal UI: single text input → calls `/api/analyze` → renders the JSON dump.
6. Commit each step with the `Wk1:` prefix; end of week: merge to `main`, log Week 1 in CHANGELOG.md (hours, deploy URL, screenshots), water the Terra farm.

---

*Plan drafted 2026-10-09. Revision planned for end of Week 1 if scope deviates.*
