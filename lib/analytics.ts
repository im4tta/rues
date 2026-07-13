import type { Developer, Repo, Item } from "@/lib/types";

// Connected-components clustering over the link graph.
// Returns a map of item id -> cluster index (0-based, deterministic order).
export function computeClusters(items: Item[]): Map<string, number> {
  const adj = new Map<string, Set<string>>();
  for (const it of items) {
    if (!adj.has(it.id)) adj.set(it.id, new Set());
    const links = it.kind === "dev" ? it.data.linkedRepos : it.data.linkedDevs;
    for (const l of links || []) {
      const other = it.kind === "dev" ? `repo:${l}` : `dev:${l}`;
      if (adj.has(other)) {
        adj.get(it.id)!.add(other);
        if (!adj.has(other)) adj.set(other, new Set());
        adj.get(other)!.add(it.id);
      }
    }
  }
  const seen = new Set<string>();
  const clusters: string[][] = [];
  for (const id of adj.keys()) {
    if (seen.has(id)) continue;
    const stack = [id];
    const comp: string[] = [];
    seen.add(id);
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const nb of adj.get(cur) || []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    clusters.push(comp);
  }
  clusters.sort((a, b) => b.length - a.length);
  const map = new Map<string, number>();
  clusters.forEach((comp, i) => comp.forEach((id) => map.set(id, i)));
  return map;
}

const CLUSTER_COLORS = [
  "#a78bfa", "#5fd9a4", "#f0b429", "#7aa2f7", "#e06c9f",
  "#56b6c2", "#d19a66", "#98c379", "#c678dd", "#e5c07b",
  "#61afef", "#e06c75", "#be5046", "#98c379", "#56b6c2",
];

export function clusterColor(index: number): string {
  return CLUSTER_COLORS[index % CLUSTER_COLORS.length];
}

// Suggest tags for a dev based on profile + linked repos context.
export function suggestDevTags(dev: Partial<Developer>, linkedRepos: Repo[] = []): string[] {
  const tags = new Set<string>();
  const bio = (dev.bio || "").toLowerCase();
  const name = (dev.name || "").toLowerCase();
  const loc = (dev.location || "").toLowerCase();

  const knownOrgs = [
    "facebook", "meta", "google", "alphabet", "microsoft", "apple",
    "amazon", "netflix", "vercel", "github", "shopify", "stripe",
    "cloudflare", "airbnb", "uber", "linkedin", "twitter", "x",
    "openai", "anthropic", "deepmind", "nvidia", "tesla", "spotify",
  ];
  for (const org of knownOrgs) {
    if (bio.includes(org) || name.includes(org) || (dev.username || "").toLowerCase().includes(org)) {
      tags.add(org);
    }
  }
  if (/phnom|khmer|cambodia|ខ្មែរ/.test(bio) || /phnom|khmer|cambodia/.test(loc)) tags.add("cambodia");
  if (/founder|co-?founder|ceo|cto|creator/.test(bio)) tags.add("founder");
  if (/maintainer|core team|staff|principal/.test(bio)) tags.add("core-team");
  if (/designer|ux|ui/.test(bio)) tags.add("design");
  if (/writer|author|blogger|teacher|instructor/.test(bio)) tags.add("writer");
  if (/student|university|college|phd|researcher/.test(bio)) tags.add("student");

  const langs = new Set<string>();
  linkedRepos.forEach((r) => r.language && langs.add(r.language.toLowerCase()));
  if (langs.has("typescript") || langs.has("javascript")) tags.add("js");
  if (langs.has("python")) tags.add("python");
  if (langs.has("rust")) tags.add("rust");
  if (langs.has("go")) tags.add("golang");

  return Array.from(tags).slice(0, 6);
}

// Suggest tags for a repo based on its metadata.
export function suggestRepoTags(repo: Partial<Repo>): string[] {
  const tags = new Set<string>();
  const desc = (repo.description || "").toLowerCase();
  const name = (repo.fullName || "").toLowerCase();
  const lic = (repo.language || "").toLowerCase();

  if (lic) tags.add(lic.toLowerCase());
  if (/cli|command.?line/.test(name + desc)) tags.add("cli");
  if (/ui|component|design system|react/.test(desc)) tags.add("ui");
  if (/api|sdk|client/.test(desc)) tags.add("api");
  if (/bot|discord|slack|telegram/.test(desc)) tags.add("bot");
  if (/ml|ai|llm|model|neural/.test(desc)) tags.add("ai");
  if (/template|boilerplate|starter/.test(desc)) tags.add("template");
  if (/docs|documentation/.test(desc)) tags.add("docs");
  if (/game/.test(desc)) tags.add("game");
  if (/tool|util|helper/.test(desc)) tags.add("tool");

  return Array.from(tags).slice(0, 6);
}

export type DigestEntry = {
  kind: "new" | "removed" | "stars" | "sync";
  text: string;
};

// Build a textual digest of activity within the last `days` days.
export function buildDigest(data: { devs: Record<string, Developer>; repos: Record<string, Repo> }, days = 7): DigestEntry[] {
  const now = Date.now();
  const out: DigestEntry[] = [];
  const cutoff = now - days * 86400000;

  for (const r of Object.values(data.repos)) {
    const added = r.addedAt ? new Date(r.addedAt).getTime() : 0;
    if (added >= cutoff) out.push({ kind: "new", text: `Repo ${r.fullName} added` });
  }
  for (const d of Object.values(data.devs)) {
    const added = d.addedAt ? new Date(d.addedAt).getTime() : 0;
    if (added >= cutoff) out.push({ kind: "new", text: `Developer @${d.username} added` });
    const synced = d.lastSynced ? new Date(d.lastSynced).getTime() : 0;
    if (synced >= cutoff) out.push({ kind: "sync", text: `@${d.username} synced` });
  }
  if (out.length === 0) out.push({ kind: "sync", text: `No new activity in the last ${days} days — all quiet.` });
  return out;
}
