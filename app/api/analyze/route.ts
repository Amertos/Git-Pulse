import { NextRequest } from "next/server";

// idk if these are all the fields but it works for now
interface GhData {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  license: any; 
  created_at: string;
  pushed_at: string;
}

// basic cache thingy because i dont want to hit github limits
let cacheStorage: any = {}; 

export async function GET(req: NextRequest) {
  const urlParams = new URL(req.url).searchParams;
  const repoInput = urlParams.get("repo") || "";

  if (!repoInput) {
    return Response.json({ error: "bruh, where is the link?" }, { status: 400 });
  }

  // trying to get owner/repo from the string
  let owner = "";
  let name = "";
  
  try {
    const temp = repoInput.replace("https://github.com/", "").split("/");
    owner = temp[0];
    name = temp[1].replace(".git", "");
  } catch (e) {
    return Response.json({ error: "link is dead or wrong lol" }, { status: 400 });
  }

  const key = `${owner}/${name}`;
  
  // check cache
  if (cacheStorage[key] && (Date.now() - cacheStorage[key].time < 600000)) {
    console.log("found it in cache, we chillin");
    return Response.json({ ...cacheStorage[key].data, cached: true });
  }

  try {
    const headers: any = { "User-Agent": "my-cool-app" };
    if (process.env.GITHUB_TOKEN) {
      headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
    }

    // fetch repo info
    const r1 = await fetch(`https://api.github.com/repos/${owner}/${name}`, { headers });
    if (!r1.ok) throw new Error("Github said No: " + r1.status);
    const meta = await r1.json() as GhData;

    // fetch languages 
    const r2 = await fetch(`https://api.github.com/repos/${owner}/${name}/languages`, { headers });
    const langs = await r2.json();
    
    let total = 0;
    for (let key in langs) { total += langs[key]; }

    let languagesArray = [];
    for (let key in langs) {
      languagesArray.push({
        name: key,
        percent: Math.round((langs[key] / total) * 100)
      });
    }

    // fetch commits (just last page)
    const r3 = await fetch(`https://api.github.com/repos/${owner}/${name}/commits?per_page=100`, { headers });
    const rawCommits = await r3.json();
    
    let weekCounts = new Array(12).fill(0);
    rawCommits.forEach((c: any) => {
      let d = new Date(c.commit.committer.date).getTime();
      let diff = Math.floor((Date.now() - d) / (7 * 24 * 60 * 60 * 1000));
      if (diff >= 0 && diff < 12) weekCounts[11 - diff]++;
    });

    const output = {
      repo: meta.full_name,
      description: meta.description,
      stars: meta.stargazers_count,
      forks: meta.forks_count,
      openIssues: meta.open_issues_count,
      primaryLanguage: meta.language,
      license: meta.license?.spdx_id || "none",
      createdAt: meta.created_at,
      lastPushDaysAgo: Math.floor((Date.now() - new Date(meta.pushed_at).getTime()) / 86400000),
      languages: languagesArray.sort((a,b) => b.percent - a.percent),
      recentCommitWeeks: weekCounts
    };

    cacheStorage[key] = { time: Date.now(), data: output };
    return Response.json(output);

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}