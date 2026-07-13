"use client";

import React, { useEffect, useState } from "react";
import { loadDirectory } from "@/lib/storage";
import type { Developer, Repo } from "@/lib/types";

export default function SharePage() {
  const [devs, setDevs] = useState<Record<string, Developer>>({});
  const [repos, setRepos] = useState<Record<string, Repo>>({});
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const d = loadDirectory();
    setDevs(d.devs);
    setRepos(d.repos);
    setReady(true);
  }, []);

  const devList = Object.values(devs);
  const repoList = Object.values(repos);
  const totalLinks = devList.reduce((a, d) => a + (d.linkedRepos || []).length, 0);

  const copyUrl = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (!ready) {
    return <div className="min-h-full bg-[var(--bg)] text-[var(--text)]" />;
  }

  return (
    <div className="min-h-full bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto w-full max-w-3xl px-5 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Rues <span className="font-khmer text-[var(--violet-text)]">ឫស</span></h1>
            <p className="mt-1 text-[13px] text-[var(--text-3)]">
              {devList.length} developers · {repoList.length} repositories · {totalLinks} links
            </p>
          </div>
          <button
            onClick={copyUrl}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-soft)] hover:border-[var(--violet-text)] hover:text-[var(--violet-text)]"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        <section className="mt-8">
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-[var(--text-3)]">Developers</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {devList.map((d) => (
              <a
                key={d.username}
                href={`https://github.com/${d.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 hover:border-[var(--violet-text)]"
              >
                {d.avatar_url ? (
                  <img src={d.avatar_url} alt={d.username} className="h-9 w-9 rounded-full" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-[var(--surface-2)]" />
                )}
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-[var(--text)]">{d.name || d.username}</div>
                  <div className="truncate text-[11px] text-[var(--text-3)]">
                    @{d.username} · {(d.linkedRepos || []).length} repos
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-[var(--text-3)]">Repositories</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {repoList.map((r) => (
              <a
                key={r.fullName}
                href={r.htmlUrl || `https://github.com/${r.fullName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 hover:border-[var(--mint-text)]"
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-[13px] font-medium text-[var(--text)]">{r.fullName}</span>
                  <span className="ml-2 shrink-0 text-[11px] text-[var(--text-3)]">★ {r.stars ?? 0}</span>
                </div>
                {r.description && <p className="mt-1 truncate text-[11px] text-[var(--text-3)]">{r.description}</p>}
                {r.language && <span className="mt-1 inline-block text-[10px] text-[var(--text-3)]">{r.language}</span>}
              </a>
            ))}
          </div>
        </section>

        <p className="mt-10 text-center text-[11px] text-[var(--text-4)]">
          Generated with Rues — your local-first developer & repo tracker.
        </p>
      </div>
    </div>
  );
}
