# Git-Pulse

Paste a GitHub link, get back a report card: stars, forks, open issues, language
mix, commit activity over the last 12 weeks, contributor count, and a rough
"momentum" score for whether the repo is alive or quietly dying.

Built with Next.js + TypeScript + Tailwind. No auth, no database — just the
public GitHub API (with a 10-minute cache so I don't burn through the
rate limit).

## Run it

```
npm install
npm run dev
```

Then open http://localhost:3210 and paste a repo like `vercel/next.js`.

Optional: set `GITHUB_TOKEN` in `.env.local` for a higher rate limit.

## Known gaps

- Momentum score formula is hand-tuned, not scientific
- Commit history only looks at the most recent 100 commits
- No tests yet (todo)
