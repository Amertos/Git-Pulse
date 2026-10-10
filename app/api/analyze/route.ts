import { NextRequest } from "next/server";

// what github gives us back for /repos/{owner}/{repo}
type RepoMeta = {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  license: { spdx_id: string | null } | null;
  created_at: string;
  pushed_at: string;
};

// rough in-memory cache so we don't hammer github & hit rate limits.
// keyed by "owner/repo", expire after 10 min. fine for now — if this ever
// gets real traffic it wants redis, not a module-level Map.
const cache = new Map<
  string,
  { at: number; body: AnalyzeResponse }
>();
const TEN_MINS_MS = 10 * 60 * 1000;

type AnalyzeResponse = {
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
  analyzedAt: string;
  cached?: boolean;
};

// pull owner/repo out of a github url like
//   https://github.com/vercel/next.js
//   git@github.com:vercel/next.js.git
//   vercel/next.js
function parseRepo(input: string):
  | { ok: true; owner: string; repo: string }
  | { ok: false; error: string } {
  let cleaned = input.trim();
  if (!cleaned) return { ok: false, error: "Paste a repo link (or owner/name)." };

  // strip known prefixes
  cleaned = cleaned
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git$/i, "");

  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return { ok: false, error: "That doesn't look like a github repo. Try owner/name." };
  }
  return { ok: true, owner: parts[0], repo: parts[1] };
}

// health-ish score. is this repo alive or dead?
// weighted so the freshest few weeks matter most — a repo that was busy
// 6 months ago should score lower than one pushing last week.
// TODO: this formula is hand-tuned and I don't fully trust it yet.
function computeMomentum(weeks: number[], stars: number): number {
  const recent = weeks.slice(-4).reduce((a, b) => a + b, 0);
  const total = weeks.reduce((a, b) => a + b, 0);
  if (total === 0) return stars > 0 ? 12 : 0; // old project w/ watchers gets a whiff of credit

  // decay heuristic: recent-4-weeks get 2x weight vs the rest
  const ratio = recent / Math.max(total, 1);
  const activity = Math.min(total / 20, 1); // 20 commits in 12w = probably alive
  const score = Math.round(ratio * 55 + activity * 35 + Math.min(stars / 500, 10));
  return Math.max(0, Math.min(score, 100));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawRepo = searchParams.get("repo") ?? "";
  const parsed = parseRepo(rawRepo);

  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const { owner, repo } = parsed;
  const cacheKey = `${owner}/${repo}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TEN_MINS_MS) {
    return Response.json({ ...hit.body, cached: true });
  }

  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    // github api wants a user agent or it 403s
    "User-Agent": "gitpulse-dev",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const base = `https://api.github.com/repos/${owner}/${repo}`;

    // repo meta + languages can go in parallel, saves ~200ms per call
    const [metaRes, langRes, commitRes, contribRes] = await Promise.all([
      fetch(base, { headers, cache: "no-store" }),
      fetch(`${base}/languages`, { headers, cache: "no-store" }),
      fetch(`${base}/commits?per_page=100`, { headers, cache: "no-store" }),
      // ?anon=1 counts anonymous contributors too (people who never signed a CLA)
      fetch(`${base}/contributors?per_page=1&anon=1`, { headers, cache: "no-store" }),
    ]);

    if (metaRes.status === 404) {
      return Response.json(
        { error: `Can't find ${owner}/${repo} — is it public?` },
        { status: 404 },
      );
    }
    if (!metaRes.ok) {
      const detail =
        metaRes.status === 403
          ? "GitHub rate limit hit, wait a minute and try again."
          : `GitHub API returned ${metaRes.status}`;
      return Response.json({ error: detail }, { status: 502 });
    }

    const meta = (await metaRes.json()) as RepoMeta;

    // languages + commits failing isn't fatal, show what we can
    const langJson = langRes.ok ? ((await langRes.json()) as Record<string, number>) : {};
    const commitJson = commitRes.ok
      ? ((await commitRes.json()) as { commit: { committer: { date: string } } }[])
      : [];
    // contributors returns an array; a Link header with rel="last" tells us total count
    let contributorsCount = 0;
    if (contribRes.ok) {
      const link = contribRes.headers.get("link") ?? "";
      const lastMatch = /page=(\d+)>; rel="last"/.exec(link);
      if (lastMatch) {
        contributorsCount = parseInt(lastMatch[1], 10);
      } else {
        const body = (await contribRes.json()) as unknown[];
        contributorsCount = Array.isArray(body) ? body.length : 0;
      }
    }

    // percentages from byte counts github reports per language
    const totalBytes = Object.values(langJson).reduce((a, b) => a + b, 0);
    const languages = Object.entries(langJson)
      .map(([name, bytes]) => ({
        name,
        percent: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 8);

    // bucket last 100 commits into 12 weekly slots, newest first
    const weeks = new Array<number>(12).fill(0);
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const c of commitJson) {
      const t = new Date(c?.commit?.committer?.date ?? 0).getTime();
      const ago = Math.floor((now - t) / WEEK_MS);
      if (ago >= 0 && ago < 12) weeks[11 - ago]++;
    }

    const openIssues = meta.open_issues_count;
    // issues per contributor gives a rough sense of how backed-up the
    // maintainers are. big numbers here = abandoned-ish project.
    const issuesPerBranch =
      contributorsCount > 0
        ? Math.round((openIssues / contributorsCount) * 10) / 10
        : null;

    const body: AnalyzeResponse = {
      repo: meta.full_name,
      description: meta.description,
      stars: meta.stargazers_count,
      forks: meta.forks_count,
      openIssues,
      primaryLanguage: meta.language,
      license: meta.license?.spdx_id ?? null,
      createdAt: meta.created_at,
      lastPushDaysAgo: Math.floor(
        (now - new Date(meta.pushed_at).getTime()) / (1000 * 60 * 60 * 24),
      ),
      languages,
      recentCommitWeeks: weeks,
      contributorsCount,
      issuesPerBranch,
      momentumScore: computeMomentum(weeks, meta.stargazers_count),
      analyzedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, { at: Date.now(), body });
    return Response.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "something unexpected went wrong";
    console.error("[analyze]", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
