"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Developer, Repo } from "@/lib/types";
import { sortItems } from "@/lib/sort";

type Filter = "all" | "devs" | "repos";
type SortKey = "name" | "stars" | "lastSynced" | "addedAt";
type ViewKey = "list" | "grid";
type ThemeKey = "dark" | "light" | "angkor" | "mekong";

export function ShareView({
  devs,
  repos,
  handle,
  publishedAt,
}: {
  devs: Record<string, Developer>;
  repos: Record<string, Repo>;
  handle?: string;
  publishedAt?: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [view, setView] = useState<ViewKey>("grid");
  const [theme, setTheme] = useState<ThemeKey>("dark");
  const [langFilter, setLangFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const languages = useMemo(
    () => Array.from(new Set(Object.values(repos).map((r) => r.language).filter(Boolean) as string[])).sort(),
    [repos]
  );
  const tags = useMemo(
    () =>
      Array.from(
        new Set([
          ...Object.values(devs).flatMap((d) => d.tags || []),
          ...Object.values(repos).flatMap((r) => r.tags || []),
        ])
      ).sort(),
    [devs, repos]
  );

  const devList = useMemo(() => Object.values(devs), [devs]);
  const repoList = useMemo(() => Object.values(repos), [repos]);
  const totalLinks = devList.reduce((a, d) => a + (d.linkedRepos || []).length, 0);

  const items = useMemo(() => {
    const q = query.toLowerCase();
    const filteredDevs = devList.filter(
      (d) =>
        (filter === "all" || filter === "devs") &&
        (d.username + (d.name || "") + (d.tags || []).join(" ")).toLowerCase().includes(q)
    );
    const filteredRepos = repoList.filter(
      (r) =>
        (filter === "all" || filter === "repos") &&
        (r.fullName + (r.description || "") + (r.tags || []).join(" ")).toLowerCase().includes(q)
    );
    let merged: any[] = [
      ...filteredDevs.map((d) => ({ kind: "dev" as const, id: `dev:${d.username}`, data: d })),
      ...filteredRepos.map((r) => ({ kind: "repo" as const, id: `repo:${r.fullName}`, data: r })),
    ];
    merged = merged.filter((it) => {
      if (langFilter && it.kind === "repo" && (it.data.language || "") !== langFilter) return false;
      if (tagFilter && !(it.data.tags || []).includes(tagFilter)) return false;
      return true;
    });
    return sortItems(merged, sort);
  }, [devList, repoList, query, filter, sort, langFilter, tagFilter]);

  const copyUrl = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const Tab = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={`rounded px-2.5 py-1 text-[12px] ${
        active ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="min-h-full bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto w-full max-w-4xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">
              Rues <span className="font-khmer text-[var(--violet-text)]">ឫស</span>
            </h1>
            <p className="mt-1 text-[13px] text-[var(--text-3)]">
              {handle ? `@${handle} · ` : ""}
              {devList.length} developers · {repoList.length} repositories · {totalLinks} links
              {publishedAt ? ` · updated ${new Date(publishedAt).toLocaleDateString()}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemeKey)}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="angkor">Angkor</option>
              <option value="mekong">Mekong</option>
            </select>
            <button
              onClick={copyUrl}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-soft)] hover:border-[var(--violet-text)] hover:text-[var(--violet-text)]"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="search…"
              className="w-full bg-transparent text-[12px] text-[var(--text)] outline-none placeholder-[var(--placeholder)]"
            />
          </div>
          <div className="flex rounded-md border border-[var(--border)] p-0.5 font-mono text-[11px]">
            {(["all", "devs", "repos"] as const).map((f) => (
              <Tab key={f} active={filter === f} onClick={() => setFilter(f)}>
                {f}
              </Tab>
            ))}
          </div>
          <div className="flex rounded-md border border-[var(--border)] p-0.5 text-[11px]">
            <Tab active={view === "list"} onClick={() => setView("list")}>list</Tab>
            <Tab active={view === "grid"} onClick={() => setView("grid")}>grid</Tab>
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-[12px] text-[var(--text)] outline-none"
          >
            <option value="name">name</option>
            <option value="stars">stars</option>
            <option value="lastSynced">synced</option>
            <option value="addedAt">added</option>
          </select>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {languages.length > 0 && (
            <select
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text)] outline-none"
            >
              <option value="">all languages</option>
              {languages.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          )}
          {tags.length > 0 && (
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] text-[var(--text)] outline-none"
            >
              <option value="">all tags</option>
              {tags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
          <span className="text-[11px] text-[var(--text-3)]">{items.length} shown</span>
        </div>

        {/* Results */}
        <section className="mt-6">
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] py-10 text-center text-[13px] text-[var(--text-3)]">
              Nothing matches your filters.
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((it) =>
                it.kind === "dev" ? (
                  <a
                    key={it.id}
                    href={`https://github.com/${it.data.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 hover:border-[var(--violet-text)]"
                  >
                    {it.data.avatar_url ? (
                      <img src={it.data.avatar_url} alt={it.data.username} className="h-10 w-10 rounded-full" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-[var(--surface-2)]" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-[var(--text)]">{it.data.name || it.data.username}</span>
                        {it.data.isMe && (
                          <span className="rounded-full bg-[var(--violet-text)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white">you</span>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-[var(--text-3)]">
                        @{it.data.username} · {(it.data.linkedRepos || []).length} repos
                      </div>
                    </div>
                  </a>
                ) : (
                  <a
                    key={it.id}
                    href={it.data.htmlUrl || `https://github.com/${it.data.fullName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 hover:border-[var(--mint-text)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium text-[var(--text)]">{it.data.fullName}</span>
                      <span className="shrink-0 text-[11px] text-[var(--text-3)]">★ {it.data.stars ?? 0}</span>
                    </div>
                    {it.data.description && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-[var(--text-3)]">{it.data.description}</p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--text-3)]">
                      {it.data.language && <span>{it.data.language}</span>}
                      {(it.data.tags || []).slice(0, 3).map((t: string) => (
                        <span key={t} className="rounded-full bg-[var(--surface-2)] px-1.5 py-0.5">{t}</span>
                      ))}
                    </div>
                  </a>
                )
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((it) =>
                it.kind === "dev" ? (
                  <a
                    key={it.id}
                    href={`https://github.com/${it.data.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 hover:border-[var(--violet-text)]"
                  >
                    {it.data.avatar_url ? (
                      <img src={it.data.avatar_url} alt={it.data.username} className="h-9 w-9 rounded-full" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-[var(--surface-2)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-[var(--text)]">{it.data.name || it.data.username}</span>
                        {it.data.isMe && (
                          <span className="rounded-full bg-[var(--violet-text)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white">you</span>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-[var(--text-3)]">
                        @{it.data.username} · {(it.data.linkedRepos || []).length} repos
                      </div>
                    </div>
                    <span className="text-[11px] text-[var(--text-3)]">{it.data.followers ?? 0} followers</span>
                  </a>
                ) : (
                  <a
                    key={it.id}
                    href={it.data.htmlUrl || `https://github.com/${it.data.fullName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 hover:border-[var(--mint-text)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-[var(--text)]">{it.data.fullName}</div>
                      {it.data.description && (
                        <p className="truncate text-[11px] text-[var(--text-3)]">{it.data.description}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-[var(--text-3)]">★ {it.data.stars ?? 0} · {it.data.language}</span>
                  </a>
                )
              )}
            </div>
          )}
        </section>

        <p className="mt-10 text-center text-[11px] text-[var(--text-4)]">
          Generated with Rues (ឫស) — your local-first developer & repo tracker.
        </p>
      </div>
    </div>
  );
}
