"use client";

import { useState } from "react";

type RepoData = {
  repo: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  primaryLanguage: string | null;
  license: string | null;
  createdAt: string;
  lastPushDaysAgo: number;
  languages: { name: string; percent: number }[];
  recentCommitWeeks: number[];
  contributorsCount: number;
  issuesPerBranch: number | null;
  momentumScore: number;
  cached?: boolean;
};

// picked these to match the amber accent in globals.css
const BAR_COLORS = ["#f2b21b", "#e07a5f", "#81b29a", "#7b8cde", "#b58392", "#5f7d95", "#a1887f", "#78909c"];

function momentumLabel(score: number): string {
  if (score >= 70) return "Open-source fire";
  if (score >= 45) return "Healthy and humming";
  if (score >= 20) return "Alive but coasting";
  if (score > 0) return "Barely a pulse";
  return "No pulse";
}

function days(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 30) return `${n} days ago`;
  const m = Math.floor(n / 30);
  return m === 1 ? "1 month ago" : `${m} months ago`;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RepoData | null>(null);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setData(null);

    try {
      const res = await fetch(`/api/analyze?repo=${encodeURIComponent(url)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something broke, try again.");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error, try again.");
    } finally {
      setLoading(false);
    }
  }

  const maxCommits = data
    ? Math.max(...data.recentCommitWeeks, 1)
    : 1;

  return (
    <div className="min-h-screen px-4 pb-16">
      <main className="mx-auto max-w-xl pt-14">
        <header className="mb-10">
          <h1 className="flex items-baseline gap-2 text-4xl font-semibold tracking-tight">
            Git<span className="text-[var(--accent)]">Pulse</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
              v0.1
            </span>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
            Paste a GitHub link. Get a report card on whether the repo is thriving,
            coasting, or quietly dying — stars, language mix, commit rhythm, the lot.
          </p>
        </header>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            required
            spellCheck={false}
            autoCapitalize="off"
            placeholder="vercel/next.js or a full URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[#5c6069] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#1a1508] transition-opacity disabled:opacity-40 hover:opacity-85"
          >
            {loading ? "Checking…" : "Analyze"}
          </button>
        </form>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-[#5a3a3a] bg-[#2a1e20] px-4 py-3 text-sm text-[#e79a9a]"
          >
            {error}
          </p>
        )}

        {data && (
          <section className="mt-8 space-y-4 pb-16">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold">{data.repo}</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {data.description ?? "No description provided."}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[10px] uppercase text-[var(--muted)]">
                  {data.cached ? "cached" : "fresh"}
                </span>
              </div>

              {/* momentum gauge */}
              <div className="mt-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                    Momentum
                  </span>
                  <span className="text-sm text-[var(--foreground)]">
                    {momentumLabel(data.momentumScore)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]"
                    style={{ width: `${data.momentumScore}%` }}
                  />
                </div>
                <p className="mt-1.5 text-right font-mono text-xs text-[var(--muted)]">
                  {data.momentumScore}/100
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Stars" value={data.stars.toLocaleString()} />
              <Stat label="Forks" value={data.forks.toLocaleString()} />
              <Stat label="Open issues" value={data.openIssues.toLocaleString()} />
              <Stat
                label="Contributors"
                value={data.contributorsCount > 0 ? String(data.contributorsCount) : "—"}
              />
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Commit activity · last 12 weeks
              </h3>
              <div className="flex h-24 items-end gap-1.5">
                {data.recentCommitWeeks.map((count, i) => (
                  <div key={i} className="group flex-1">
                    <div
                      title={`${count} commit${count === 1 ? "" : "s"}`}
                      className="w-full rounded-t bg-[var(--accent)]/80 transition-colors group-hover:bg-[var(--accent)]"
                      style={{
                        height: `${Math.max((count / maxCommits) * 96, 3)}px`,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[10px] text-[var(--muted)]">
                <span>12w ago</span>
                <span>now</span>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Language mix
              </h3>
              <div className="flex h-3 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                {data.languages.map((lang, i) => (
                  <div
                    key={lang.name}
                    title={`${lang.name} ${lang.percent}%`}
                    style={{ width: `${lang.percent}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                  />
                ))}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {data.languages.map((lang, i) => (
                  <li key={lang.name} className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                    <span
                      className="inline-block h-2 w-2 rounded-sm"
                      style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                    />
                    {lang.name} <span className="font-mono">{lang.percent}%</span>
                  </li>
                ))}
              </ul>
              {data.languages.length === 0 && (
                <p className="text-sm text-[var(--muted)]">No language data.</p>
              )}
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 text-sm">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                The details
              </h3>
              <dl className="space-y-2">
                <Row label="Last push" value={days(data.lastPushDaysAgo)} />
                <Row label="License" value={data.license ?? "none"} />
                <Row
                  label="Issues per contributor"
                  value={data.issuesPerBranch !== null ? data.issuesPerBranch.toFixed(1) : "—"}
                />
                <Row label="First commit" value={new Date(data.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} />
                <Row label="Primary language" value={data.primaryLanguage ?? "unknown"} />
              </dl>
            </div>

            <p className="text-center font-mono text-[10px] text-[#4a4e57]">
              gitpulse · built over one very long weekend · not affiliated with github
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="font-mono text-right">{value}</dd>
    </div>
  );
}
