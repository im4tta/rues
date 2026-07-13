"use client";

import type { DirectoryData, ViewPreset } from "./types";
import { cleanDirectory, emptyDirectory } from "./types";

// Filesystem storage (data/directory.json) doesn't work on Vercel — serverless
// functions get a fresh, read-only filesystem per invocation, so nothing written
// there persists. localStorage keeps this a true zero-config, zero-backend app
// that works identically in `npm run dev` and on Vercel. Trade-off: data lives
// per-browser, not per-account — the Export/Import JSON buttons exist so people
// can back up or move their directory between browsers/devices.

const STORAGE_KEY = "dev-directory:v1";

export function loadDirectory(): DirectoryData {
  if (typeof window === "undefined") return emptyDirectory();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDirectory();
    const parsed = JSON.parse(raw);
    return cleanDirectory({
      devs: parsed?.devs && typeof parsed.devs === "object" ? parsed.devs : {},
      repos: parsed?.repos && typeof parsed.repos === "object" ? parsed.repos : {},
      folders: Array.isArray(parsed?.folders) ? parsed.folders : []
    });
  } catch {
    return emptyDirectory();
  }
}

export function saveDirectory(data: DirectoryData): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    // Most likely private-browsing mode or quota exceeded.
    return false;
  }
}

const PRESETS_KEY = "dev-directory:presets:v1";

export function loadPresets(): ViewPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePresets(presets: ViewPreset[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    /* ignore */
  }
}

const ME_KEY = "dev-directory:me:v1";
const PUBLISH_KEY = "dev-directory:publish:v1";

export function loadMyUsername(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(ME_KEY) || "";
  } catch {
    return "";
  }
}

export function saveMyUsername(username: string): void {
  if (typeof window === "undefined") return;
  try {
    if (username) window.localStorage.setItem(ME_KEY, username);
    else window.localStorage.removeItem(ME_KEY);
  } catch {
    /* ignore */
  }
}

export function loadPublishHandle(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(PUBLISH_KEY) || "";
  } catch {
    return "";
  }
}

export function savePublishHandle(handle: string): void {
  if (typeof window === "undefined") return;
  try {
    if (handle) window.localStorage.setItem(PUBLISH_KEY, handle);
    else window.localStorage.removeItem(PUBLISH_KEY);
  } catch {
    /* ignore */
  }
}
