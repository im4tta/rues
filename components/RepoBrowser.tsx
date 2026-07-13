"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Search, Star, X } from "lucide-react";
import type { Repo } from "@/lib/types";
import { ghUserRepos } from "@/lib/github";

export function RepoBrowser({
  username,
  existing,
  onAdd,
  onClose,
  setToast
}: {
  username: string;
  existing: Record<string, Repo>;
  onAdd: (repos: Repo[]) => void;
  onClose: () => void;
  setToast: (s: string) => void;
}) {
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await ghUserRepos(username);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "Failed to load repos");
        if (active) setRepos(j.repos || []);
      } catch (e: any) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [username]);

  const filtered = repos.filter(
    (r) => !query || (r.fullName + (r.description || "") + (r.language || "")).toLowerCase().includes(query.toLowerCase())
  );

  const toggle = (fullName: string) => {
    setChecked((c) => {
      const next = new Set(c);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  };

  const addSelected = () => {
    const picks = repos.filter((r) => checked.has(r.fullName) && !existing[r.fullName]);
    if (picks.length === 0) {
      onClose();
      return;
    }
    const mapped: Repo[] = picks.map((r) => ({
      fullName: r.fullName,
      description: r.description,
      stars: r.stars,
      language: r.language,
      htmlUrl: r.htmlUrl,
      lastCommit: r.lastCommit,
      tags: [],
      notes: "",
      linkedDevs: [username],
      lastSynced: r.lastSynced,
      addedAt: new Date().toISOString()
    }));
    onAdd(mapped);
    setAdding(true);
    setToast(`Added ${mapped.length} repo${mapped.length === 1 ? "" : "s"} for @${username}`);
    setTimeout(() => setToast(""), 2500);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center bg-black/50 p-4 pt-[8vh]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 className="font-display text-[16px] font-semibold text-[var(--text)]">Browse @{username}'s repos</h2>
            <p className="text-[11px] text-[var(--text-3)]">
              {repos.length} public repos · pick the ones worth tracking
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2">
          <Search size={13} className="text-[var(--text-3)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="filter repos…"
            className="flex-1 bg-transparent text-[12px] text-[var(--text)] outline-none placeholder-[var(--placeholder)]"
          />
        </div>

        <div className="list-scroll flex-1 overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center py-10 text-[var(--text-3)]">
              <Loader2 className="animate-spin" size={20} />
            </div>
          )}
          {error && (
            <div className="m-3 flex items-center gap-2 rounded-md border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-[12px] text-[var(--danger-text)]">
              <AlertCircle size={13} /> {error}
            </div>
          )}
          {!loading &&
            !error &&
            filtered.map((r) => {
              const isChecked = checked.has(r.fullName);
              const already = !!existing[r.fullName];
              return (
                <button
                  key={r.fullName}
                  onClick={() => !already && toggle(r.fullName)}
                  className={`flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-[var(--surface-2)] ${
                    already ? "opacity-50" : ""
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isChecked ? "border-[var(--mint-text)] bg-[var(--mint-bg)]" : "border-[var(--border-subtle)]"
                    }`}
                  >
                    {isChecked && <Check size={11} className="text-[var(--mint-text)]" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-mono text-[12px] text-[var(--text)]">{r.fullName}</span>
                      {already && (
                        <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-3)]">
                          tracked
                        </span>
                      )}
                    </div>
                    {r.description && (
                      <p className="truncate text-[11px] text-[var(--text-2)]">{r.description}</p>
                    )}
                    <div className="mt-0.5 flex items-center gap-3 font-mono text-[10px] text-[var(--text-3)]">
                      {r.language && <span>{r.language}</span>}
                      <span className="flex items-center gap-1">
                        <Star size={10} /> {r.stars ?? "—"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          {!loading && !error && filtered.length === 0 && (
            <div className="py-10 text-center text-[12px] text-[var(--text-3)]">No repos match your filter.</div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
          <span className="text-[11px] text-[var(--text-3)]">
            {checked.size} selected{checked.size > 0 && ` · ${username} will be auto-linked`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChecked(new Set(repos.filter((r) => !existing[r.fullName]).map((r) => r.fullName)))}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-soft)] hover:border-[var(--violet-text)] hover:text-[var(--violet-text)]"
            >
              Select new
            </button>
            <button
              onClick={addSelected}
              disabled={adding || checked.size === 0}
              className="rounded-md bg-[var(--mint-text)] px-3 py-1.5 text-[12px] font-medium text-[var(--bg)] hover:opacity-90 disabled:opacity-50"
            >
              Add selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

