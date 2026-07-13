"use client";

import { useRef, useState } from "react";
import type { StickyNote } from "@/lib/types";

export const STICKY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  yellow: { bg: "bg-[#fef3c7]", border: "border-[#fbbf24]", text: "text-[#92400e]" },
  blue: { bg: "bg-[#dbeafe]", border: "border-[#60a5fa]", text: "text-[#1e40af]" },
  green: { bg: "bg-[#d1fae5]", border: "border-[#34d399]", text: "text-[#065f46]" },
  pink: { bg: "bg-[#fce7f3]", border: "border-[#f472b6]", text: "text-[#9d174d]" },
  purple: { bg: "bg-[#ede9fe]", border: "border-[#a78bfa]", text: "text-[#5b21b6]" },
  orange: { bg: "bg-[#ffedd5]", border: "border-[#fb923c]", text: "text-[#9a3412]" },
};



export function StickyNoteCard({ note, onUpdate, onDelete }: {
  note: StickyNote;
  onUpdate: (id: string, patch: Partial<StickyNote>) => void;
  onDelete: (id: string) => void;
}) {
  const colors = STICKY_COLORS;
  const c = colors[note.color] || colors.yellow;
  const [minimized, setMinimized] = useState(true);
  const collapseTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const preview = note.content.split("\n").find((l) => l.trim()) || "Empty note";

  const scheduleCollapse = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setMinimized(true), 2000);
  };
  const cancelCollapse = () => {
    if (collapseTimer.current) { clearTimeout(collapseTimer.current); collapseTimer.current = null; }
  };

  return (
    <div
      onClick={() => { cancelCollapse(); setMinimized((v) => !v); }}
      className="group cursor-pointer"
      style={{ perspective: "600px" }}
    >
      <div
        className="transition-all duration-500 ease-in-out"
        style={{
          transformStyle: "preserve-3d",
          transform: minimized ? "rotateX(0deg)" : "rotateX(360deg)",
        }}
      >
        <div
          className={`rounded-lg border ${c.border} ${c.bg} p-2.5 shadow-sm transition-all duration-300`}
          style={{ backfaceVisibility: "hidden" }}
        >
          {minimized ? (
            <div className="flex items-center gap-2">
              <span className="truncate text-[12px] font-medium italic" style={{ color: c.text }}>{preview}</span>
              <span className="ml-auto shrink-0 text-[9px] text-[var(--text-4)] opacity-0 transition-opacity group-hover:opacity-100">expand</span>
            </div>
          ) : (
            <>
              <textarea
                value={note.content}
                onChange={(e) => onUpdate(note.id, { content: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                onBlur={scheduleCollapse}
                onFocus={cancelCollapse}
                className={`w-full resize-none bg-transparent text-[12px] ${c.text} outline-none placeholder-[var(--text-4)]`}
                placeholder="Write a sticky note…"
                rows={3}
                autoFocus
              />
              <div className="mt-1.5 flex items-center justify-between">
                <div className="flex gap-1">
                  {Object.keys(colors).map((colorKey) => (
                    <button key={colorKey} onClick={(e) => { e.stopPropagation(); onUpdate(note.id, { color: colorKey }); }}
                      className={`h-3.5 w-3.5 rounded-full border ${colors[colorKey].border} ${colors[colorKey].bg} ${note.color === colorKey ? "ring-2 ring-[var(--violet-text)]" : "opacity-50 hover:opacity-100"}`}
                      title={colorKey}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-[var(--text-4)]">collapse</span>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} className="text-[10px] text-[var(--text-3)] hover:text-[var(--danger-text-hover)]">✕</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

