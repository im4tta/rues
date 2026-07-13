"use client";

import { Folder } from "@/lib/types";

export function FolderPicker({
  folders,
  value,
  onChange,
  compact,
}: {
  folders: Folder[];
  value?: string;
  onChange: (folderId: string | undefined) => void;
  compact?: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      title="Folder"
      aria-label="Assign to folder"
      className={`max-w-[140px] rounded border border-[var(--border)] bg-[var(--surface-input)] px-1.5 py-1 text-[11px] text-[var(--text-soft)] outline-none hover:border-[var(--violet-border)] focus:border-[var(--violet-border)] ${
        compact ? "" : ""
      }`}
    >
      <option value="">Unfiled</option>
      {folders.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </select>
  );
}
