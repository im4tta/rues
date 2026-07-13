// Client-side GitHub API client.
//
// IMPORTANT: these calls go directly from the BROWSER to https://api.github.com
// (GitHub's REST API supports CORS). This means the unauthenticated 60 req/hour
// rate limit is charged against each *visitor's own IP* — not the Rues server.
// No token is used on purpose, so no single shared bucket can be exhausted by
// one person and block everyone else.
//
// Each function mirrors the exact JSON contract of the old Next.js server routes
// (app/api/github/*) and returns a Response-shaped object ({ ok, status, json() })
// so the component call sites stay unchanged.

const API = "https://api.github.com";

function ghHeaders(): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function ok(data: any): Response {
  return new Response(JSON.stringify(data), { status: 200 });
}

function fail(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status });
}

async function ghJson(url: string): Promise<{ res: Response; json: any }> {
  let res: Response;
  try {
    res = await fetch(url, { headers: ghHeaders(), cache: "no-store" });
  } catch {
    return {
      res: fail(502, "Couldn't reach GitHub — check your network connection."),
      json: null,
    };
  }
  const json = await res.json().catch(() => null);
  return { res, json };
}

function rateLimitMessage(res: Response): string | null {
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("X-RateLimit-Remaining");
    if (remaining === "0" || remaining === null) {
      const reset = Number(res.headers.get("X-RateLimit-Reset") || "0");
      if (reset) {
        const mins = Math.max(1, Math.round((reset * 1000 - Date.now()) / 60000));
        return `GitHub API limit reached — resets in ~${mins} min (your own IP, not shared with others)`;
      }
      return "GitHub API rate limit reached — try again shortly";
    }
  }
  return null;
}

function toFail(res: Response, subject: string): Response {
  if (res.status === 404) return fail(404, `${subject} not found`);
  const rl = rateLimitMessage(res);
  if (rl) return fail(403, rl);
  return fail(res.status, `GitHub error (${res.status})`);
}

function summarize(e: any): string {
  const repo = e?.repo?.name || "";
  const ref =
    e?.payload?.ref?.replace("refs/heads/", "") ||
    e?.payload?.ref?.replace("refs/tags/", "tag ") ||
    "";
  switch (e?.type) {
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
      return `${String(e?.type || "").replace(/Event$/, "").replace(/([A-Z])/g, " $1").trim()} in ${repo}`;
  }
}

export async function ghUser(username: string): Promise<Response> {
  const { res, json } = await ghJson(`${API}/users/${encodeURIComponent(username)}`);
  if (!res.ok) return toFail(res, `@${username}`);
  return ok({
    username: json.login,
    name: json.name,
    avatar_url: json.avatar_url,
    bio: json.bio,
    followers: json.followers,
    location: json.location,
    lastSynced: new Date().toISOString(),
  });
}

export async function ghRepo(owner: string, repo: string): Promise<Response> {
  const full = `${owner}/${repo}`;
  const { res, json } = await ghJson(`${API}/repos/${encodeURIComponent(full)}`);
  if (!res.ok) return toFail(res, full);
  let lastCommit: string | null = json.pushed_at;
  try {
    const c = await ghJson(`${API}/repos/${encodeURIComponent(full)}/commits?per_page=1`);
    if (c.res.ok && Array.isArray(c.json) && c.json[0]) {
      lastCommit = c.json[0].commit?.author?.date || json.pushed_at;
    }
  } catch {
    // fall back to pushed_at, already set
  }
  return ok({
    fullName: json.full_name,
    description: json.description,
    stars: json.stargazers_count,
    language: json.language,
    htmlUrl: json.html_url,
    lastCommit,
    lastSynced: new Date().toISOString(),
  });
}

export async function ghUserEvents(username: string): Promise<Response> {
  const { res, json } = await ghJson(
    `${API}/users/${encodeURIComponent(username)}/events/public`
  );
  if (!res.ok) {
    const rl = rateLimitMessage(res);
    return ok({
      events: [],
      error: rl ?? (res.status === 404 ? `@${username} not found` : `GitHub error (${res.status})`),
    });
  }
  const events = (Array.isArray(json) ? json : [])
    .slice(0, 30)
    .map((e: any) => ({
      id: e.id,
      type: e.type,
      created_at: e.created_at,
      repo: e.repo?.name,
      summary: summarize(e),
    }));
  return ok({ events });
}

export async function ghContributors(owner: string, repo: string): Promise<Response> {
  const full = `${owner}/${repo}`;
  const { res, json } = await ghJson(
    `${API}/repos/${encodeURIComponent(full)}/contributors?per_page=30`
  );
  if (!res.ok) return toFail(res, full);
  const contributors = (Array.isArray(json) ? json : []).map((c: any) => ({
    login: c.login,
    avatar_url: c.avatar_url,
    contributions: c.contributions ?? 0,
    html_url: c.html_url,
  }));
  return ok({ fullName: full, contributors });
}

export async function ghStarred(username: string): Promise<Response> {
  const { res, json } = await ghJson(
    `${API}/users/${encodeURIComponent(username)}/starred?per_page=100`
  );
  if (!res.ok) return toFail(res, `@${username}`);
  const repos = Array.isArray(json)
    ? json.filter((r: any) => r?.full_name).map((r: any) => r.full_name as string)
    : [];
  return ok({ repos });
}

export async function ghUserRepos(username: string): Promise<Response> {
  const { res, json } = await ghJson(
    `${API}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated&type=owner`
  );
  if (!res.ok) return toFail(res, `@${username}`);
  const repos = Array.isArray(json)
    ? json.map((j: any) => ({
        fullName: j.full_name,
        description: j.description,
        stars: j.stargazers_count,
        language: j.language,
        htmlUrl: j.html_url,
        lastCommit: j.pushed_at,
        lastSynced: new Date().toISOString(),
      }))
    : [];
  return ok({ repos });
}
