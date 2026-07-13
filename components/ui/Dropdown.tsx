"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";

export function Dropdown({
  trigger,
  title,
  children,
  width = "w-56"
}: {
  trigger: React.ReactNode;
  title?: string;
  children: (close: () => void) => React.ReactNode;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<"left" | "right">("right");
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useClickOutside(ref, () => setOpen(false), open);

  // Keep the panel within the viewport horizontally. Anchoring right-0 by
  // default overflows off the left edge of narrow/portrait screens when the
  // trigger sits toward the left of the toolbar, so flip to left-aligned
  // whenever a right-aligned panel would clip. A CSS media-query fallback in
  // globals.css (.dropdown-panel) backs this up on small screens in case
  // this measurement runs before layout has settled.
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const triggerRect = ref.current.getBoundingClientRect();
    const panelWidth = panelRef.current?.offsetWidth ?? 224;
    const margin = 8;
    const rightAlignedLeft = triggerRect.right - panelWidth;
    setAlign(rightAlignedLeft < margin ? "left" : "right");
  }, [open]);

  // Hover-to-open should only ever react to an actual mouse. Checking
  // device capability up front (e.g. via matchMedia("(hover: hover)"))
  // is unreliable — many mobile browsers and in-app webviews misreport
  // it. Instead we check the pointerType of each individual pointer
  // event: touch/pen taps are ignored, only real mouse movement opens
  // the menu on hover. This is what previously made the button need two
  // taps on mobile — a touch tap fired a synthetic hover-open immediately
  // followed by the click's toggle, which closed it again.
  const handlePointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setOpen(true);
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    hoverTimeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 200);
  };

  return (
    <div
      className="relative"
      ref={ref}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={title}
        className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--text-3)] hover:text-[var(--text)]"
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panelRef}
          className={`dropdown-panel absolute ${align === "right" ? "right-0" : "left-0"} z-30 mt-1 ${width} max-w-[calc(100vw-1rem)] rounded-md border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl`}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-1 py-1">
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--text-3)]">{label}</div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

export function SegBtn({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded px-2 py-1 text-[11px] ${
        active ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text-3)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}

