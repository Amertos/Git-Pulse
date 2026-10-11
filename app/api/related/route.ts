import { NextRequest } from "next/server";

// recent forks + trending repos from GitHub, unauthenticated.
// both endpoints are free (rate-limited, so we cap aggressively) —
// that's the whole point: the related panel works without a token.

const TEN_MINS_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; body: RelatedResponse }>();

type RelatedResponse = {
  repo: string;
  forks: number;
  trendItems: { full_name: string; url: string; stars: number; language: string | null; pushedDaysAgo: number }[];
  reason: string;
  cached?: boolean;
};

function daysAgo(iso: string): number {
  const then = new Date(iso).getTime();
  return Math.max(0, Math.round((Date.now() - then) / (1000 * 60 * 60 * 24)));
}

function parseRepo(input: string): { ok: true; owner: string; repo: string } | { ok: false } {
  const t = input.trim().replace(/^https?:\/\/(www\.)?github\.com\/|\/?$|\.git$/g, "").replace(/^git@github\.com:/, "");
  const parts = t.split("/").filter(Boolean);
  if (parts.length < 2) return { ok: false };
  return { ok: true, owner: parts[0], repo: parts[1] };
}

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const rawRepo = params.get("repo") ?? "";

  const parsed = parseRepo(rawRepo);
  if (!parsed.ok) {
    return Response.json({ error: "bad repo", reason: "no recent forks, no trend match" }, { status: 400 });
  }

  const { owner, repo } = parsed;
  const cacheKey = `${owner}/${repo}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TEN_MINS_MS) {
    return Response.json({ ...hit.body, cached: true });
  }

  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "gitpulse-dev",
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // recent forks — newest first, single page is enough for a panel
  const forksUrl = `https://api.github.com/repos/${owner}/${repo}/forks?sort=newest&per_page=100`;
  let forkCount = 0;
  let forksRaw: { full_name: string }[] = [];
  try {
    const fr = await fetch(forksUrl, { headers, cache: "no-store" });
    if (fr.ok) {
      forksRaw = (await fr.json()) as { full_name: string }[];
      forkCount = forksRaw.length;
    } else if (fr.status === 404) {
      // private repo or gone — treat as zero, don't fail the panel
      forkCount = 0;
    }
  } catch {
    forkCount = 0;
  }

  // trending-ish: same language, recent pushes, nonzero stars.
  // we only run this when we have a primary language from the main analyze call.
  const lang = params.get("lang") ?? "";
  let trendItems: RelatedResponse["trendItems"] = [];

  if (lang && forkCount >= 0) {
    // conservative query: avoid search-rate-limit surprises
    const q = `language:${lang.replace(/[^a-zA-Z0-9+\- _]/g, "")} pushed:>=${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)} stars:>=10`;
    try {
      const sr = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=9`,
        { headers, cache: "no-store" },
      );
      if (sr.ok) {
        const json = (await sr.json()) as { items: { full_name: string; html_url: string; stargazers_count: number; language: string | null; pushed_at: string }[] };
        trendItems = json.items
          .filter((it) => it.full_name !== `${owner}/${repo}` && it.stargazers_count >= 10)
          .slice(0, 6)
          .map((it) => ({
            full_name: it.full_name,
            url: it.html_url,
            stars: it.stargazers_count,
            language: it.language,
            pushedDaysAgo: daysAgo(it.pushed_at),
          }));
      }
    } catch {
      // search can 403 harder than the rest endpoints; degrade silently
    }
  }

  const body: RelatedResponse = {
    repo: `${owner}/${repo}`,
    forks: forkCount,
    trendItems,
    reason: trendItems.length > 0 ? `public repos using ${lang} pushed recently` : "no trend match from GitHub",
  };

  cache.set(cacheKey, { at: Date.now(), body });
  return Response.json(body);
}
