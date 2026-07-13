import { NextRequest, NextResponse } from "next/server";

function summarize(e: any): string {
  const repo = e.repo?.name || "";
  const ref = e.payload?.ref?.replace("refs/heads/", "") || e.payload?.ref?.replace("refs/tags/", "tag ") || "";
  switch (e.type) {
    case "PushEvent": {
      const n = e.payload?.commits?.length || e.payload?.size || 0;
      return `Pushed ${n} commit${n === 1 ? "" : "s"}${ref ? ` to ${ref}` : ""}${repo ? ` in ${repo}` : ""}`;
    }
    case "PullRequestEvent":
      return `${e.payload?.pull_request?.merged ? "Merged" : "Opened"} a PR in ${repo}`;
    case "IssuesEvent":
      return `${e.payload?.action} an issue in ${repo}`;
    case "IssueCommentEvent":
      return `Commented on an issue in ${repo}`;
    case "WatchEvent":
      return `Starred ${repo}`;
    case "ForkEvent":
      return `Forked ${repo}`;
    case "CreateEvent":
      return `Created ${e.payload?.ref_type || "repository"}${ref ? ` ${ref}` : ""}${repo ? ` in ${repo}` : ""}`;
    case "DeleteEvent":
      return `Deleted ${e.payload?.ref_type || "branch"}${repo ? ` in ${repo}` : ""}`;
    case "PublicEvent":
      return `Made ${repo} public`;
    case "ReleaseEvent":
      return `Released ${e.payload?.release?.tag_name || ""} in ${repo}`;
    case "PullRequestReviewEvent":
      return `Reviewed a PR in ${repo}`;
    case "PullRequestReviewCommentEvent":
      return `Commented on a PR in ${repo}`;
    case "MemberEvent":
      return `Added a collaborator to ${repo}`;
    case "GollumEvent":
      return `Updated the wiki in ${repo}`;
    default:
      return `${e.type.replace(/Event$/, "").replace(/([A-Z])/g, " $1").trim()} in ${repo}`;
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  let res: Response;
  try {
    res = await fetch(`https://api.github.com/users/${username}/events/public`, {
      headers,
      next: { revalidate: 300 }
    });
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
    return NextResponse.json({ events: [], error: msg }, { status: 200 });
  }

  const j = await res.json();
  const events = (Array.isArray(j) ? j : [])
    .slice(0, 30)
    .map((e: any) => ({
      id: e.id,
      type: e.type,
      created_at: e.created_at,
      repo: e.repo?.name,
      summary: summarize(e)
    }));

  return NextResponse.json({ events });
}
