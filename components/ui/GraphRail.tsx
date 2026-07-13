"use client";

export function GraphRail() {
  return (
    <div className="absolute left-[15px] top-0 bottom-0 w-px bg-gradient-to-b from-[var(--border-subtle)] via-[var(--border-subtle)] to-transparent" />
  );
}

export function GraphDot({ color }: { color: string }) {
  return (
    <div
      className="absolute left-[10px] top-6 h-[11px] w-[11px] rounded-full border-2 border-[var(--bg)]"
      style={{ background: color }}
    />
  );
}

