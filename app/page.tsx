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

type RelatedData = {
  repo: string;
  forks: number;
  trendItems: { full_name: string; url: string; stars: number; language: string | null; pushedDaysAgo: number }[];
  reason: string;
  cached?: boolean;
};

const BAR_COLORS = ["#e8a42a", "#e07a5f", "#81b29a", "#6178a6", "#b58392", "#5f7d95", "#a1887f", "#78909c"];

// momentum band is the same as before; DEFCON-style label is a separate read.
function momentumLabel(score: number): string {
  if (score >= 70) return "Open-source fire";
  if (score >= 45) return "Healthy and humming";
  if (score >= 20) return "Alive but coasting";
  if (score > 0) return "Barely a pulse";
  return "No pulse";
}

function defconBand(score: number): string {
  // cynical, github-flavored; not real military grading.
  if (score >= 80) return "GREEN — actually alive";
  if (score >= 55) return "YELLOW — keep an eye on it";
  if (score >= 30) return "ORANGE — barely breathing";
  if (score > 0) return "RED — good luck";
  return "BLACK — tombstone energy";
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
  "asking github who maintains this…",
  "measuring the commit heartbeat…",
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

  // rotate the loading message every ~900ms so long fetches don't feel dead.
  // fade the line in/out so the swap isn't a hard cut.
  useEffect(() => {
    if (!loading) return;
    let i = 0;
    setLoadingLine(FUN_LOADING_LINES[0]);
    const t = setInterval(() => {
      setLoadingLine((prev) => {
        const next = FUN_LOADING_LINES[(i + 1) % FUN_LOADING_LINES.length];
        i = (i + 1) % FUN_LOADING_LINES.length;
        return next;
      });
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

  const [related, setRelated] = useState<RelatedData | null>(null);
  const [relatedReason, setRelatedReason] = useState("");

  async function analyze(input: string) {
    setLoading(true);
    setError("");
    setData(null);
    setRelated(null);
    setRelatedReason("");

    try {
      const res = await fetch(`/api/analyze?repo=${encodeURIComponent(input)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something broke, try again.");
      setData(json);
      remember(json.repo);
      // update the url bar so the report is linkable
      window.history.replaceState(null, "", `/?repo=${encodeURIComponent(json.repo)}`);

      // related panel is softer than the report; stale is fine, fetch after.
      const lang = json.primaryLanguage ?? "";
      const rr = await fetch(`/api/related?repo=${encodeURIComponent(json.repo)}${lang ? `&lang=${encodeURIComponent(lang)}` : ""}`);
      const rj = await rr.json();
      if (rr.ok) {
        setRelated(rj);
        setRelatedReason(rj.reason);
      }
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
            className="spring shrink-0 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#1a1508] disabled:opacity-50 disabled:cursor-not-allowed"
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
          <section className="mt-8 space-y-4 pb-16">              <div className="anim-rise card rounded-xl border border-[var(--line)] p-5">
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

            <div className="anim-rise anim-delay-1 grid grid-cols-2 gap-3">
              <Stat label="Stars" value={data.stars.toLocaleString()} />
              <Stat label="Forks" value={data.forks.toLocaleString()} />
              <Stat label="Open issues" value={data.openIssues.toLocaleString()} />
              <Stat
                label="Contributors"
                value={data.contributorsCount > 0 ? String(data.contributorsCount) : "—"}
              />
            </div>

            <div className="anim-rise anim-delay-2 card rounded-xl border border-[var(--line)] p-5">
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

            <div className="anim-rise anim-delay-3 card rounded-xl border border-[var(--line)] p-5">
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

            <div className="anim-rise anim-delay-4 card rounded-xl border border-[var(--line)] p-5 text-sm">
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

            {/* related repos panel — recent forks + same-language trending */}
            {related && (
              <div className="anim-rise anim-delay-4 card-deep rounded-xl border border-[var(--line)] p-5 relative overflow-hidden">
                <div className="gear-sweep" aria-hidden="true" />
                <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                  Around this repo
                </h3>
                <p className="mb-4 text-[11px] text-[#6b7280] italic">
                  {relatedReason}
                </p>

                <div className="mb-4 flex items-baseline gap-2">
                  <span className="text-xs text-[var(--muted)]">recent forks</span>
                  <span className="font-mono text-sm text-[var(--foreground)]">{related.forks.toLocaleString()}</span>
                  {related.forks >= 3000 && (
                    <span className="ml-auto rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--accent)]">
                      high fork count
                    </span>
                  )}
                </div>

                {related.trendItems.length > 0 ? (
                  <ul className="space-y-2">
                    {related.trendItems.map((t) => (
                      <li key={t.full_name} className="flex items-center justify-between gap-3 rounded border border-[var(--line)] px-3 py-2">
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 flex-1 text-left text-sm text-[var(--foreground)] hover:text-[var(--accent)]"
                        >
                          {t.full_name}
                        </a>
                        <div className="shrink-0 flex items-center gap-2 text-[10px] text-[var(--muted)]">
                          {t.stars > 0 && (
                            <span className="font-mono">
                              {t.stars >= 1000
                                ? `${(t.stars / 1000).toFixed(1)}k`
                                : String(t.stars)}
                            </span>
                          )}
                          {t.language && <span className="uppercase">{t.language}</span>}
                          {t.pushedDaysAgo <= 7 && <span className="text-[var(--accent)]">active</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    nothing trending in the same lane right now — could be a quiet corner of github.
                  </p>
                )}
              </div>
            )}

            {/* cynical debrief for the report card */}
            {data && (
              <div className="mt-5 rounded border border-[var(--line)] bg-[var(--surface-raised)]/40 px-4 py-3 text-[11px] leading-relaxed text-[#b9bdc6]">
                <span className="font-semibold text-[var(--accent)]">{defconBand(data.momentumScore)}</span>
                <span className="text-[var(--muted)]">
                  &nbsp;&middot;&nbsp; gear ratio: the repo's current velocity vs its own history &mdash; not vs anyone else's repo.
                </span>
              </div>
            )}

            <p className="mt-8 text-center font-mono text-[10px] text-[#52565f]">
              gitpulse · built over one very long weekend · not affiliated with github
            </p>
          </section>
        )}
      </main>
      <div className="scroll-shimmer" aria-hidden="true" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card rounded-xl border border-[var(--line)] p-4">
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
