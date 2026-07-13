"use client";

import { Check } from "lucide-react";

export function SelectBox({
  selected,
  onToggle,
  label
}: {
  selected: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className="rounded p-1.5 hover:bg-[var(--surface-2)]"
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded border ${
          selected ? "border-[var(--mint-text)] bg-[var(--mint-bg)]" : "border-[var(--border-subtle)]"
        }`}
      >
        {selected && <Check size={11} className="text-[var(--mint-text)]" />}
      </span>
    </button>
  );
}

