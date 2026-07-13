"use client";

import { useState } from "react";
import { Chip } from "./Chip";

export function TagEditor({
  tags,
  onChange,
  tone,
  compact
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  tone: "mint" | "violet" | "amber";
  compact?: boolean;
}) {
  const [val, setVal] = useState("");
  const add = () => {
    const t = val.trim().replace(/,$/, "");
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setVal("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <Chip key={t} tone={tone} onRemove={() => onChange(tags.filter((x) => x !== t))}>
          {t}
        </Chip>
      ))}
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={() => val.trim() && add()}
        placeholder="+ tag"
        className={`w-16 bg-transparent font-mono text-[var(--text-3)] placeholder-[var(--placeholder)] outline-none ${
          compact ? "text-[10px]" : "text-[11px]"
        }`}
      />
    </div>
  );
}

