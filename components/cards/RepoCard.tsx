"use client";

import { useEffect, useRef, useState } from "react";
import {
  Clock,
  Copy,
  ExternalLink,
  GitCommit,
  Link2,
  Loader2,
  RefreshCw,
  Star,
  Trash2,
  User
} from "lucide-react";
import type { Developer, Repo, Folder } from "@/lib/types";
import { buildRepoMarkdown } from "@/lib/obsidian";
import { formatDateTime, syncLabel } from "@/lib/format";
import { copyText } from "@/lib/download";
import { getPlatform } from "@/lib/platform";
import { useClickOutside } from "@/hooks/useClickOutside";
import { Chip } from "@/components/ui/Chip";
import { TagEditor } from "@/components/ui/TagEditor";
import { SelectBox } from "@/components/ui/SelectBox";
import { FolderPicker } from "@/components/ui/FolderPicker";
import { GraphRail, GraphDot } from "@/components/ui/GraphRail";
import { StickyNoteCard } from "@/components/ui/StickyNoteCard";
import { PlatformIcon } from "@/components/ui/PlatformIcon";

export function RepoCard({
  repo,
  allDevs,
  onUpdate,
  onDelete,
  onRefresh,
  onLink,
  refreshing,
  setToast,
  compact,
  variant,
  selectable,
  selected,
  onToggleSelect,
  folders,
  onSetFolder
}: {
  repo: Repo;
  allDevs: Record<string, Developer>;
  onUpdate: (fullName: string, patch: Partial<Repo>) => void;
  onDelete: (fullName: string) => void;
  onRefresh: (fullName: string) => void;
  onLink: (username: string, fullName: string) => void;
  refreshing: boolean;
  setToast: (s: string) => void;
  compact?: boolean;
  variant?: "list" | "grid";
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  folders: Folder[];
  onSetFolder: (folderId: string | undefined) => void;
}) {
  const [notesBuf, setNotesBuf] = useState(repo.notes || "");
  useEffect(() => setNotesBuf(repo.notes || ""), [repo.notes]);
  const [linking, setLinking] = useState(false);
  const linkRef = useRef<HTMLDivElement>(null);
  useClickOutside(linkRef, () => setLinking(false), linking);
  const unlinked = Object.keys(allDevs).filter((u) => !(repo.linkedDevs || []).includes(u));
  const grid = variant === "grid";
  const pad = compact ? "p-2.5" : grid ? "p-3" : "p-4";
  const mt = compact ? "mt-2" : "mt-3";
  const avatar = compact ? "h-8 w-8" : grid ? "h-9 w-9" : "h-11 w-11";
  const avatarIcon = compact ? 14 : grid ? 16 : 20;
  const linkedDevs = repo.linkedDevs || [];

  return (
    <div className={`relative ${grid ? "" : "pl-10"}`}>
      {!grid && <GraphRail />}
      {!grid && <GraphDot color="var(--mint-text)" />}
      <div className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] ${pad}`}>
        <div className="flex items-start gap-3">
          <div
            className={`flex shrink-0 items-center justify-center rounded-md bg-[var(--mint-icon-bg)] text-[var(--mint-text)] ${avatar}`}
          >
            <PlatformIcon platform={getPlatform(repo.htmlUrl)} size={avatarIcon} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h3 className={`font-display font-semibold text-[var(--text)] ${grid ? "break-words" : "truncate"}`}>
                {repo.fullName}
              </h3>
              <a
                href={repo.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-mono text-[11px] text-[var(--text-2)] hover:text-[var(--mint-text)]"
              >
                view <ExternalLink size={10} />
              </a>
            </div>
            {repo.description && (
              <p className="mt-0.5 break-words text-[12px] text-[var(--text-2)]">{repo.description}</p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-[11px] text-[var(--text-3)]">
              <span className="flex items-center gap-1">
                <Star size={11} />
                {repo.stars ?? "—"}
              </span>
              {repo.language && <span>{repo.language}</span>}
              <span className="flex items-center gap-1" title={repo.lastCommit ? formatDateTime(repo.lastCommit) : undefined}>
                <GitCommit size={11} />
                {repo.lastCommit ? syncLabel(repo.lastCommit) : "—"}
              </span>
              <span className="flex items-center gap-1" title={repo.lastSynced ? formatDateTime(repo.lastSynced) : undefined}>
                <Clock size={11} />
                synced {syncLabel(repo.lastSynced)}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <FolderPicker folders={folders} value={repo.folderId} onChange={onSetFolder} compact={compact} />
            {selectable && (
              <SelectBox
                selected={!!selected}
                onToggle={() => onToggleSelect?.()}
                label={`Select ${repo.fullName}`}
              />
            )}
            <button
              onClick={() => onRefresh(repo.fullName)}
              className="rounded p-1.5 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--mint-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mint-text)]"
              title="Re-sync from GitHub"
              aria-label={`Re-sync ${repo.fullName} from GitHub`}
            >
              {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </button>
            <button
              onClick={() => copyText(buildRepoMarkdown(repo), setToast)}
              className="rounded p-1.5 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--mint-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mint-text)]"
              title="Copy as Obsidian note"
              aria-label={`Copy ${repo.fullName} as Obsidian note`}
            >
              <Copy size={14} />
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Remove ${repo.fullName} from tracking?`)) onDelete(repo.fullName);
              }}
              className="rounded p-1.5 text-[var(--text-3)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--danger-text-hover)]"
              title="Remove"
              aria-label={`Remove ${repo.fullName}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className={mt}>
          <TagEditor
            tags={repo.tags || []}
            tone="amber"
            compact={compact}
            onChange={(tags) => onUpdate(repo.fullName, { tags })}
          />
        </div>

          <div className={`${mt} flex flex-wrap items-center gap-1.5`}>
            {linkedDevs.map((u) => (
              <Chip key={u} tone="violet" onRemove={() => onLink(u, repo.fullName)}>
                <User size={10} className="inline -mt-px" /> {u}
              </Chip>
            ))}
            <div className="relative" ref={linkRef}>
              <button
                onClick={() => setLinking((v) => !v)}
                className="flex items-center gap-1 rounded-full border border-dashed border-[var(--border-subtle)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-3)] hover:text-[var(--violet-text)]"
                aria-expanded={linking}
              >
                <Link2 size={10} /> {!grid && "link dev"}
              </button>
            {linking && (
              <div className="absolute z-10 mt-1 max-h-40 w-56 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--surface-input)] p-1 shadow-xl">
                {unlinked.length === 0 && (
                  <div className="px-2 py-1.5 text-[11px] text-[var(--text-3)]">
                    No unlinked devs — add one first.
                  </div>
                )}
                {unlinked.map((u) => (
                  <button
                    key={u}
                    onClick={() => {
                      onLink(u, repo.fullName);
                      setLinking(false);
                    }}
                    className="block w-full truncate rounded px-2 py-1 text-left font-mono text-[11px] text-[var(--text-soft)] hover:bg-[var(--surface-2)]"
                  >
                    @{u}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <textarea
          value={notesBuf}
          onChange={(e) => setNotesBuf(e.target.value)}
          onBlur={() => onUpdate(repo.fullName, { notes: notesBuf })}
          placeholder="Notes — why it's on your radar, ideas to borrow…"
          rows={compact || grid ? 1 : 2}
          className="mt-3 w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface-input)] p-2 text-[12px] text-[var(--text-soft)] placeholder-[var(--placeholder)] outline-none focus:border-[var(--mint-border)]"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(repo.stickyNotes || []).map((sn) => (
            <StickyNoteCard
              key={sn.id}
              note={sn}
              onUpdate={(id, patch) => {
                const notes = (repo.stickyNotes || []).map((n) => n.id === id ? { ...n, ...patch } : n);
                onUpdate(repo.fullName, { stickyNotes: notes });
              }}
              onDelete={(id) => {
                const notes = (repo.stickyNotes || []).filter((n) => n.id !== id);
                onUpdate(repo.fullName, { stickyNotes: notes });
              }}
            />
          ))}
          <button
            onClick={() => {
              const notes = [...(repo.stickyNotes || []), { id: Date.now().toString(), content: "", color: "yellow", createdAt: new Date().toISOString() }];
              onUpdate(repo.fullName, { stickyNotes: notes });
            }}
            className="flex items-center gap-1 rounded-md border border-dashed border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--text-3)] hover:border-[var(--mint-border)] hover:text-[var(--mint-text)]"
          >
            + sticky
          </button>
        </div>
      </div>
    </div>
  );
}

