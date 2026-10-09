import { NextRequest } from "next/server";

interface RepoMeta {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  license: { spdx_id: string | null } | null;
  created_at: string;
  pushed_at: string;
  default_branch: string;
}

export interface AnalyzeResult {
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
}

// Simple in-memory cache keyed by "owner/repo". Fine for a single
// server instance; upgrades to a real cache later if needed.
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map<string, { at: number; data: AnalyzeResult }>();

const GITHUB_API = "https://api.github.com";

function parseRepoUrl(raw: string): { owner: string; repo: string } | null {
  // Accept "owner/repo" or a full GitHub URL
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(
      trimmed.startsWith("http") ? trimmed : `https://github.com/${trimmed}`
    );
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com")
      return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, repo] = parts;
    return { owner, repo: repo.replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

function ghHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "git-pulse",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: ghHeaders() });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

async function fetchLanguages(fullName: string) {
  const langs = await fetchJson<Record<string, number>>(
    `/repos/${fullName}/languages`
  );
  const total = Object.values(langs).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(langs)
    .map(([name, bytes]) => ({
      name,
      bytes,
      percent: Math.round((bytes / total) * 1000) / 10,
    }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 8);
}

// Fetches up to 100 recent commits and buckets them by ISO week
// (most recent week last). Cheap preview of the Wk5 commit graph.
async function fetchCommitActivity(fullName: string): Promise<number[]> {
  const commits = await fetchJson<
    { commit: { committer: { date: string } } }[]
  >(`/repos/${fullName}/commits?per_page=100`);
  const weeks: number[] = new Array(12).fill(0);
  const now = Date.now();
  for (const c of commits) {
    const d = new Date(c.commit.committer.date).getTime();
    const weekIdx = Math.floor((now - d) / (7 * 86_400_000));
    if (weekIdx >= 0 && weekIdx < 12) weeks[11 - weekIdx] += 1;
  }
  return weeks;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("repo") ?? "";
  const parsed = parseRepoUrl(q);
  if (!parsed) {
    return Response.json(
      { error: "Provide a GitHub repo URL or owner/repo" },
      { status: 400 }
    );
  }

  const key = `${parsed.owner}/${parsed.repo}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return Response.json({ ...hit.data, cached: true });
  }

  try {
    const meta = await fetchJson<RepoMeta>(`/repos/${key}`);
    const [languages, recentCommitWeeks] = await Promise.all([
      fetchLanguages(key),
      fetchCommitActivity(key),
    ]);

    const data: AnalyzeResult = {
      repo: meta.full_name,
      description: meta.description,
      stars: meta.stargazers_count,
      forks: meta.forks_count,
      openIssues: meta.open_issues_count,
      primaryLanguage: meta.language,
      license: meta.license?.spdx_id ?? null,
      createdAt: meta.created_at,
      lastPushDaysAgo: daysAgo(meta.pushed_at),
      languages,
      recentCommitWeeks,
      analyzedAt: new Date().toISOString(),
      cached: false,
    };

    cache.set(key, { at: Date.now(), data });
    return Response.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("404") ? 404 : 502;
    return Response.json({ error: message }, { status });
  }
}
