"use client";

import { useState } from "react";

interface AnalyzeResult {
  repo: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  primaryLanguage: string | null;
  license: string | null;
  createdAt: string;
  lastPushDaysAgo: number;
  languages: { name: string; bytes: number; percent: number }[];
  recentCommitWeeks: number[];
  analyzedAt: string;
  cached: boolean;
  error?: string;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/analyze?repo=${encodeURIComponent(input)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const maxWeek = result ? Math.max(...result.recentCommitWeeks, 1) : 1;

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8 px-6 py-20">
        <div className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Git<span className="text-emerald-500">Pulse</span>
          </h1>
          <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
            Paste a GitHub repo. Get a health report in seconds.
          </p>
        </div>

        <form onSubmit={analyze} className="flex w-full gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://github.com/vercel/next.js"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </form>

        {error && (
          <p className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {result && (
          <section className="flex w-full flex-col gap-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <header>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {result.repo}
              </h2>
              {result.description && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {result.description}
                </p>
              )}
              {result.cached && (
                <p className="mt-1 text-xs text-zinc-400">(cached result)</p>
              )}
            </header>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Stars" value={result.stars.toLocaleString()} />
              <Stat label="Forks" value={result.forks.toLocaleString()} />
              <Stat label="Open issues" value={result.openIssues.toLocaleString()} />
              <Stat
                label="Last push"
                value={
                  result.lastPushDaysAgo === 0
                    ? "today"
                    : `${result.lastPushDaysAgo}d ago`
                }
              />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Languages
              </h3>
              <div className="flex h-4 w-full overflow-hidden rounded-full">
                {result.languages.map((l, i) => (
                  <div
                    key={l.name}
                    className="h-full"
                    style={{
                      width: `${l.percent}%`,
                      backgroundColor: LANG_COLORS[i % LANG_COLORS.length],
                    }}
                    title={`${l.name} ${l.percent}%`}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                {result.languages.map((l, i) => (
                  <span
                    key={l.name}
                    className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: LANG_COLORS[i % LANG_COLORS.length],
                      }}
                    />
                    {l.name} {l.percent}%
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Commits (last 12 weeks, top 100)
              </h3>
              <div className="flex h-24 items-end gap-1">
                {result.recentCommitWeeks.map((count, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-emerald-500/80"
                    style={{ height: `${(count / maxWeek) * 100}%` }}
                    title={`${count} commits`}
                  />
                ))}
              </div>
            </div>

            <footer className="text-xs text-zinc-400">
              License: {result.license ?? "none"} · Primary:{" "}
              {result.primaryLanguage ?? "unknown"} · Created{" "}
              {new Date(result.createdAt).getFullYear()}
            </footer>
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-100 px-4 py-3 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

const LANG_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#64748b",
];
