"use client";

import { useEffect, useRef, useState } from "react";
import {
  Clock,
  Copy,
  ExternalLink,
  FolderGit2,
  FolderSearch,
  Github,
  Link2,
  Loader2,
  RefreshCw,
  Trash2,
  Users
} from "lucide-react";
import type { Developer, Repo, Folder } from "@/lib/types";
import { buildDevMarkdown } from "@/lib/obsidian";
import { formatDateTime, syncLabel } from "@/lib/format";
import { copyText } from "@/lib/download";
import { useClickOutside } from "@/hooks/useClickOutside";
import { Chip } from "@/components/ui/Chip";
import { TagEditor } from "@/components/ui/TagEditor";
import { SelectBox } from "@/components/ui/SelectBox";
import { FolderPicker } from "@/components/ui/FolderPicker";
import { GraphRail, GraphDot } from "@/components/ui/GraphRail";
import { StickyNoteCard } from "@/components/ui/StickyNoteCard";

export function DevCard({
  dev,
  allRepos,
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
  onBrowse,
  folders,
  onSetFolder
}: {
  dev: Developer;
  allRepos: Record<string, Repo>;
  onUpdate: (username: string, patch: Partial<Developer>) => void;
  onDelete: (username: string) => void;
  onRefresh: (username: string) => void;
  onLink: (username: string, fullName: string) => void;
  refreshing: boolean;
  setToast: (s: string) => void;
  compact?: boolean;
  variant?: "list" | "grid";
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onBrowse?: () => void;
  folders: Folder[];
  onSetFolder: (folderId: string | undefined) => void;
}) {
  const [notesBuf, setNotesBuf] = useState(dev.notes || "");
  useEffect(() => setNotesBuf(dev.notes || ""), [dev.notes]);
  const [linking, setLinking] = useState(false);
  const linkRef = useRef<HTMLDivElement>(null);
  useClickOutside(linkRef, () => setLinking(false), linking);
  const unlinked = Object.keys(allRepos).filter((r) => !(dev.linkedRepos || []).includes(r));
  const grid = variant === "grid";
  const pad = compact ? "p-2.5" : grid ? "p-3" : "p-4";
  const mt = compact ? "mt-2" : "mt-3";
  const avatar = compact ? "h-8 w-8" : grid ? "h-9 w-9" : "h-11 w-11";
  const avatarIcon = compact ? 14 : grid ? 16 : 20;
  const linkedRepos = dev.linkedRepos || [];

  return (
    <div className={`relative ${grid ? "" : "pl-10"}`}>
      {!grid && <GraphRail />}
      {!grid && <GraphDot color="var(--violet-text)" />}
      <div className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] ${pad}`}>
        <div className="flex items-start gap-3">
          {dev.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dev.avatar_url}
              alt=""
              className={`shrink-0 rounded-md border border-[var(--border-subtle)] ${avatar}`}
            />
          ) : (
            <div
              className={`flex shrink-0 items-center justify-center rounded-md bg-[var(--surface-2)] text-[var(--violet-text)] ${avatar}`}
            >
              <Github size={avatarIcon} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h3 className={`font-display font-semibold text-[var(--text)] ${grid ? "break-words" : "truncate"}`}>
                {dev.name || dev.username}
              </h3>
              {dev.isMe && (
                <span className="rounded-full bg-[var(--violet-text)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white">
                  you
                </span>
              )}
              <a
                href={`https://github.com/${dev.username}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-mono text-[11px] text-[var(--text-2)] hover:text-[var(--violet-text)]"
              >
                @{dev.username} <ExternalLink size={10} />
              </a>
            </div>
            {dev.bio && (
              <p className="mt-0.5 break-words text-[12px] text-[var(--text-2)]">{dev.bio}</p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-[11px] text-[var(--text-3)]">
              <span className="flex items-center gap-1">
                <Users size={11} />
                {dev.followers ?? "—"}
              </span>
              {dev.location && <span>{dev.location}</span>}
              <span className="flex items-center gap-1" title={dev.lastSynced ? formatDateTime(dev.lastSynced) : undefined}>
                <Clock size={11} />
                synced {syncLabel(dev.lastSynced)}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <FolderPicker folders={folders} value={dev.folderId} onChange={onSetFolder} compact={compact} />
            {selectable && (
              <SelectBox
                selected={!!selected}
                onToggle={() => onToggleSelect?.()}
                label={`Select @${dev.username}`}
              />
            )}
            <button
              onClick={() => onRefresh(dev.username)}
              className="rounded p-1.5 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--mint-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mint-text)]"
              title="Re-sync from GitHub"
              aria-label={`Re-sync @${dev.username} from GitHub`}
            >
              {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            </button>
            <button
              onClick={() => copyText(buildDevMarkdown(dev), setToast)}
              className="rounded p-1.5 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--mint-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mint-text)]"
              title="Copy as Obsidian note"
              aria-label={`Copy @${dev.username} as Obsidian note`}
            >
              <Copy size={14} />
            </button>
            {onBrowse && (
              <button
                onClick={onBrowse}
                className="rounded p-1.5 text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:text-[var(--violet-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--violet-text)]"
                title="Browse their repos"
                aria-label={`Browse repos for @${dev.username}`}
              >
                <FolderSearch size={14} />
              </button>
            )}
            <button
              onClick={() => {
                if (window.confirm(`Remove @${dev.username} from tracking?`)) onDelete(dev.username);
              }}
              className="rounded p-1.5 text-[var(--text-3)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger-text-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--danger-text-hover)]"
              title="Remove"
              aria-label={`Remove @${dev.username}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className={mt}>
          <TagEditor
            tags={dev.tags || []}
            tone="violet"
            compact={compact}
            onChange={(tags) => onUpdate(dev.username, { tags })}
          />
        </div>

          <div className={`${mt} flex flex-wrap items-center gap-1.5`}>
            {linkedRepos.map((r) => (
              <Chip key={r} tone="mint" onRemove={() => onLink(dev.username, r)}>
                <FolderGit2 size={10} className="inline -mt-px" /> {r}
              </Chip>
            ))}
            <div className="relative" ref={linkRef}>
              <button
                onClick={() => setLinking((v) => !v)}
                className="flex items-center gap-1 rounded-full border border-dashed border-[var(--border-subtle)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-3)] hover:text-[var(--mint-text)]"
                aria-expanded={linking}
              >
                <Link2 size={10} /> {!grid && "link repo"}
              </button>
            {linking && (
              <div className="absolute z-10 mt-1 max-h-40 w-56 overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--surface-input)] p-1 shadow-xl">
                {unlinked.length === 0 && (
                  <div className="px-2 py-1.5 text-[11px] text-[var(--text-3)]">
                    No unlinked repos — add one first.
                  </div>
                )}
                {unlinked.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      onLink(dev.username, r);
                      setLinking(false);
                    }}
                    className="block w-full truncate rounded px-2 py-1 text-left font-mono text-[11px] text-[var(--text-soft)] hover:bg-[var(--surface-2)]"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <textarea
          value={notesBuf}
          onChange={(e) => setNotesBuf(e.target.value)}
          onBlur={() => onUpdate(dev.username, { notes: notesBuf })}
          placeholder="Notes — why you're tracking them, context, ideas…"
          rows={compact || grid ? 1 : 2}
          className="mt-3 w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface-input)] p-2 text-[12px] text-[var(--text-soft)] placeholder-[var(--placeholder)] outline-none focus:border-[var(--violet-border)]"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(dev.stickyNotes || []).map((sn) => (
            <StickyNoteCard
              key={sn.id}
              note={sn}
              onUpdate={(id, patch) => {
                const notes = (dev.stickyNotes || []).map((n) => n.id === id ? { ...n, ...patch } : n);
                onUpdate(dev.username, { stickyNotes: notes });
              }}
              onDelete={(id) => {
                const notes = (dev.stickyNotes || []).filter((n) => n.id !== id);
                onUpdate(dev.username, { stickyNotes: notes });
              }}
            />
          ))}
          <button
            onClick={() => {
              const notes = [...(dev.stickyNotes || []), { id: Date.now().toString(), content: "", color: "yellow", createdAt: new Date().toISOString() }];
              onUpdate(dev.username, { stickyNotes: notes });
            }}
            className="flex items-center gap-1 rounded-md border border-dashed border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--text-3)] hover:border-[var(--violet-border)] hover:text-[var(--violet-text)]"
          >
            + sticky
          </button>
        </div>
      </div>
    </div>
  );
}

