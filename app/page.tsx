"use client";

import { useEffect, useState } from "react";

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

const FUN_LOADING_LINES = [
  "knocking on github's door…",
  "counting stars…",
  "reading the commit history…",
  "checking if anyone still works here…",
];

export default function Home() {
  // reading url/localStorage during first render — this needs a browser so it
  // runs client-side. wrapping in useState initializer keeps one render, not two.
  const [url, setUrl] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("repo") ?? "";
  });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RepoData | null>(null);
  const [error, setError] = useState("");
  const [loadingLine, setLoadingLine] = useState(FUN_LOADING_LINES[0]);
  const [recent, setRecent] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = JSON.parse(localStorage.getItem("gitpulse-recents") ?? "[]");
      return Array.isArray(saved) ? saved.slice(0, 5) : [];
    } catch {
      // corrupted storage, whatever, start fresh
      return [];
    }
  });

  // rotate the loading message every ~900ms so long fetches don't feel dead
  useEffect(() => {
    if (!loading) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % FUN_LOADING_LINES.length;
      setLoadingLine(FUN_LOADING_LINES[i]);
    }, 900);
    return () => clearInterval(t);
  }, [loading]);

  function remember(repo: string) {
    setRecent((prev) => {
      const next = [repo, ...prev.filter((r) => r !== repo)].slice(0, 5);
      try {
        localStorage.setItem("gitpulse-recents", JSON.stringify(next));
      } catch {
        // private browsing might block storage, not a big deal
      }
      return next;
    });
  }

  async function analyze(input: string) {
    setLoading(true);
    setError("");
    setData(null);

    try {
      const res = await fetch(`/api/analyze?repo=${encodeURIComponent(input)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something broke, try again.");
      setData(json);
      remember(json.repo);
      // update the url bar so the report is linkable
      window.history.replaceState(null, "", `/?repo=${encodeURIComponent(json.repo)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error, try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    analyze(url);
  }

  // keyboard shortcut: "/" focuses the input. borrowed from a lot of
  // hacker-news-adjacent sites. skip it when typing in any input.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        document.getElementById("repo-input")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
            id="repo-input"
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

        {/* examples for the "i don't know what to type" crowd */}
        {!data && !loading && recent.length === 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span>try:</span>
            {["facebook/react", "torvalds/linux", "midudev/la-velada-web-oficial"].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setUrl(r);
                  analyze(r);
                }}
                className="rounded border border-[var(--line)] px-2 py-0.5 hover:border-[var(--accent)] hover:text-[var(--foreground)]"
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {/* recent searches — small but nice to have */}
        {recent.length > 0 && !data && !loading && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span>recent:</span>
            {recent.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setUrl(r);
                  analyze(r);
                }}
                className="rounded border border-[var(--line)] px-2 py-0.5 hover:border-[var(--accent)] hover:text-[var(--foreground)]"
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <p aria-live="polite" className="mt-5 font-mono text-sm text-[var(--muted)]">
            {loadingLine}
          </p>
        )}

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
            <div className="anim-rise rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
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

              {/* copy-link button — handy for dropping the report in slack */}
              <button
                type="button"
                onClick={() => {
                  // best-effort copy; not worth angering anyone over the fallback
                  navigator.clipboard
                    ?.writeText(window.location.href)
                    .catch(() => {});
                }}
                className="font-mono text-[10px] text-[var(--muted)] underline decoration-dotted hover:text-[var(--accent)]"
              >
                copy report link
              </button>

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
                  className="anim-fill h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${data.momentumScore}%` }}
                />
                </div>
                <p className="mt-1.5 text-right font-mono text-xs text-[var(--muted)]">
                  {data.momentumScore}/100
                </p>
              </div>
            </div>

            <div className="anim-rise anim-delay-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Stars" value={data.stars.toLocaleString()} />
              <Stat label="Forks" value={data.forks.toLocaleString()} />
              <Stat label="Open issues" value={data.openIssues.toLocaleString()} />
              <Stat
                label="Contributors"
                value={data.contributorsCount > 0 ? String(data.contributorsCount) : "—"}
              />
            </div>

            <div className="anim-rise anim-delay-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Commit activity · last 12 weeks
              </h3>
              <div className="flex h-24 items-end gap-1.5">
                {data.recentCommitWeeks.map((count, i) => (
                  <div key={i} className="group flex-1">
                    <div
                      title={`${count} commit${count === 1 ? "" : "s"}`}
                      className="anim-col w-full rounded-t bg-[var(--accent)]/80 transition-[height,background-color] duration-300 group-hover:bg-[var(--accent)]"
                      style={{
                        animationDelay: `${0.2 + i * 0.04}s`,
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

            <div className="anim-rise anim-delay-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Language mix
              </h3>
              <div className="flex h-3 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                {data.languages.map((lang, i) => (
                  <div
                    key={lang.name}
                    title={`${lang.name} ${lang.percent}%`}
                    className="anim-fill"
                    style={{ width: `${lang.percent}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length], animationDelay: `${0.25 + i * 0.05}s` }}
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

            <div className="anim-rise anim-delay-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 text-sm">
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
