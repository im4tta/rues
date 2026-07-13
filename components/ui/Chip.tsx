"use client";

import React from "react";
import { X } from "lucide-react";

export function Chip({
  children,
  onRemove,
  tone = "mint"
}: {
  children: React.ReactNode;
  onRemove?: () => void;
  tone?: "mint" | "violet" | "amber";
}) {
  const tones: Record<string, string> = {
    mint: "bg-[var(--mint-bg)] text-[var(--mint-text)] border-[var(--mint-border)]",
    violet: "bg-[var(--violet-bg)] text-[var(--violet-text)] border-[var(--violet-border)]",
    amber: "bg-[var(--amber-bg)] text-[var(--amber-text)] border-[var(--amber-border)]"
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-mono ${tones[tone]}`}
    >
      {children}
      {onRemove && (
        <button onClick={onRemove} className="opacity-60 hover:opacity-100" aria-label="Remove">
          <X size={10} />
        </button>
      )}
    </span>
  );
}

