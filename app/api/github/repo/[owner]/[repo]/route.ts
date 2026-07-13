import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;
  const fullName = `${owner}/${repo}`;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${fullName}`, { headers, cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "Couldn't reach GitHub — check your network connection." }, { status: 502 });
  }

  if (!res.ok) {
    const msg =
      res.status === 404
        ? `${fullName} not found`
        : res.status === 403
        ? "GitHub rate limit hit — add GITHUB_TOKEN to .env.local to raise it"
        : `GitHub error (${res.status})`;
    return NextResponse.json({ error: msg }, { status: res.status });
  }

  const j = await res.json();

  let lastCommit: string | null = j.pushed_at;
  try {
    const cRes = await fetch(`https://api.github.com/repos/${fullName}/commits?per_page=1`, {
      headers,
      cache: "no-store"
    });
    if (cRes.ok) {
      const commits = await cRes.json();
      lastCommit = commits?.[0]?.commit?.author?.date || j.pushed_at;
    }
  } catch {
    // fall back to pushed_at, already set
  }

  return NextResponse.json({
    fullName: j.full_name,
    description: j.description,
    stars: j.stargazers_count,
    language: j.language,
    htmlUrl: j.html_url,
    lastCommit,
    lastSynced: new Date().toISOString()
  });
}
