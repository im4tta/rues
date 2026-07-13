import type { Item, SortKey, GroupKey } from "@/lib/types";

export function sortItems(items: Item[], sort: SortKey): Item[] {
  const arr = [...items];
  arr.sort((a, b) => {
    if (sort === "name") {
      const av = (a.kind === "dev" ? a.data.name || a.data.username : a.data.fullName).toLowerCase();
      const bv = (b.kind === "dev" ? b.data.name || b.data.username : b.data.fullName).toLowerCase();
      return av < bv ? -1 : av > bv ? 1 : 0;
    }
    const num = (it: Item) => {
      if (sort === "stars") return it.kind === "dev" ? it.data.followers ?? -1 : it.data.stars ?? -1;
      if (sort === "lastSynced") return it.data.lastSynced ? new Date(it.data.lastSynced).getTime() : 0;
      return it.data.addedAt ? new Date(it.data.addedAt).getTime() : 0;
    };
    return num(b) - num(a);
  });
  return arr;
}

export function buildSections(items: Item[], group: GroupKey): { key: string; label: string; items: Item[] }[] {
  if (group === "none") return [{ key: "all", label: "", items }];
  const map = new Map<string, Item[]>();
  const order: string[] = [];
  const push = (key: string, it: Item) => {
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(it);
  };
  for (const it of items) {
    if (group === "tag") {
      const tags = it.data.tags || [];
      if (tags.length === 0) push("__none__", it);
      else tags.forEach((t) => push(t, it));
    } else {
      const links = it.kind === "dev" ? it.data.linkedRepos : it.data.linkedDevs;
      if (!links || links.length === 0) push("__none__", it);
      else links.forEach((l) => push(l, it));
    }
  }
  return order.map((k) => ({
    key: k,
    label: k === "__none__" ? (group === "tag" ? "Untagged" : "Unlinked") : k,
    items: map.get(k)!
  }));
}
