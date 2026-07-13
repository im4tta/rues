"use client";

import React from "react";
import { Github, FolderGit2 } from "lucide-react";

export function PlatformIcon({ platform, size = 16, className = "" }: { platform: string; size?: number; className?: string }) {
  if (platform === "github") return <Github size={size} className={className} />;
  if (platform === "huggingface") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  );
  if (platform === "npm") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="6" width="20" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <text x="12" y="15" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor">npm</text>
    </svg>
  );
  if (platform === "pypi") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="6" width="20" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <text x="12" y="15" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor">Py</text>
    </svg>
  );
  return <FolderGit2 size={size} className={className} />;
}

