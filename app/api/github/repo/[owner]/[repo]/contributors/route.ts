import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
    res = await fetch(`https://api.github.com/repos/${fullName}/contributors?per_page=30`, {
      headers,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Couldn't reach GitHub — check your network connection." }, { status: 502 });
  }

  if (res.status === 404) {
    return NextResponse.json({ error: `${fullName} not found` }, { status: 404 });
  }
  if (res.status === 403) {
    return NextResponse.json(
      { error: "GitHub rate limit hit — add GITHUB_TOKEN to .env.local to raise it" },
      { status: 403 }
    );
  }
  if (!res.ok) {
    return NextResponse.json({ error: `GitHub error (${res.status})` }, { status: res.status });
  }

  const j = await res.json();
  const contributors = (Array.isArray(j) ? j : []).map((c: any) => ({
    login: c.login,
    avatar_url: c.avatar_url,
    contributions: c.contributions ?? 0,
    html_url: c.html_url,
  }));

  return NextResponse.json({ fullName, contributors });
}
