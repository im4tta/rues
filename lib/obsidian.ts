import type { Developer, Repo } from "./types";

export function slug(fullName: string): string {
  return fullName.replace("/", "-");
}

export function buildDevMarkdown(dev: Developer): string {
  const tags = (dev.tags || []).map((t) => `"${t}"`).join(", ");
  const links = (dev.linkedRepos || []).map((r) => `- [[${slug(r)}]] — https://github.com/${r}`).join("\n") || "- (none linked yet)";
  return [
    "---",
    "type: developer",
    `github: ${dev.username}`,
    `tags: [${tags}]`,
    `followers: ${dev.followers ?? ""}`,
    `location: "${dev.location || ""}"`,
    "---",
    "",
    `# ${dev.name || dev.username}`,
    "",
    `**GitHub:** [@${dev.username}](https://github.com/${dev.username})`,
    `**Bio:** ${dev.bio || "—"}`,
    `**Followers:** ${dev.followers ?? "—"}  **Location:** ${dev.location || "—"}`,
    "",
    "## Projects",
    links,
    "",
    "## Notes",
    dev.notes || "",
    ""
  ].join("\n");
}

export function buildRepoMarkdown(repo: Repo): string {
  const tags = (repo.tags || []).map((t) => `"${t}"`).join(", ");
  const links = (repo.linkedDevs || []).map((u) => `- [[${u}]] — https://github.com/${u}`).join("\n") || "- (none linked yet)";
  return [
    "---",
    "type: project",
    `repo: ${repo.fullName}`,
    `tags: [${tags}]`,
    `stars: ${repo.stars ?? ""}`,
    `language: "${repo.language || ""}"`,
    "---",
    "",
    `# ${repo.fullName}`,
    "",
    `**Description:** ${repo.description || "—"}`,
    `**Stars:** ${repo.stars ?? "—"}  **Language:** ${repo.language || "—"}  **Last commit:** ${
      repo.lastCommit ? new Date(repo.lastCommit).toLocaleDateString() : "—"
    }`,
    `**URL:** ${repo.htmlUrl}`,
    "",
    "## Developers",
    links,
    "",
    "## Notes",
    repo.notes || "",
    ""
  ].join("\n");
}

function fmt(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function buildDevMarkdownMd(dev: Developer): string {
  const links = (dev.linkedRepos || []).map((r) => `- [${r}](https://github.com/${r})`).join("\n") || "- (none linked yet)";
  return [
    `# ${dev.name || dev.username} (@${dev.username})`,
    "",
    `**GitHub:** [@${dev.username}](https://github.com/${dev.username})`,
    `**Bio:** ${dev.bio || "—"}`,
    `**Followers:** ${dev.followers ?? "—"}  **Location:** ${dev.location || "—"}`,
    `**Last synced:** ${fmt(dev.lastSynced)}`,
    "",
    "## Projects",
    links,
    "",
    "## Notes",
    dev.notes || "",
    ""
  ].join("\n");
}

export function buildRepoMarkdownMd(repo: Repo): string {
  const links = (repo.linkedDevs || []).map((u) => `- [@${u}](https://github.com/${u})`).join("\n") || "- (none linked yet)";
  return [
    `# ${repo.fullName}`,
    "",
    `**Description:** ${repo.description || "—"}`,
    `**Stars:** ${repo.stars ?? "—"}  **Language:** ${repo.language || "—"}  **Last commit:** ${fmt(repo.lastCommit)}`,
    `**URL:** ${repo.htmlUrl}`,
    "",
    "## Developers",
    links,
    "",
    "## Notes",
    repo.notes || "",
    ""
  ].join("\n");
}
