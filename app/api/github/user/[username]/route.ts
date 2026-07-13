import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  let res: Response;
  try {
    res = await fetch(`https://api.github.com/users/${username}`, { headers, cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "Couldn't reach GitHub — check your network connection." }, { status: 502 });
  }

  if (!res.ok) {
    const msg =
      res.status === 404
        ? `@${username} not found`
        : res.status === 403
        ? "GitHub rate limit hit — add GITHUB_TOKEN to .env.local to raise it"
        : `GitHub error (${res.status})`;
    return NextResponse.json({ error: msg }, { status: res.status });
  }

  const j = await res.json();
  return NextResponse.json({
    username: j.login,
    name: j.name,
    avatar_url: j.avatar_url,
    bio: j.bio,
    followers: j.followers,
    location: j.location,
    lastSynced: new Date().toISOString()
  });
}
