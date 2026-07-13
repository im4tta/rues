import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Server-side store for published directories.
//
// This app is intentionally local-first / zero-backend, so there is no database
// by default. To make /share/[slug] actually show the *publisher's* data to
// anyone, we persist snapshots to a JSON file on disk. This works for `npm run
// dev` and for a long-running Node server.
//
// On serverless (Vercel) the filesystem is ephemeral and not shared between
// invocations, so writes won't reliably persist there. To make publishing work
// on serverless, swap `readAll`/`writeAll` below for a KV store (Vercel KV,
// Upstash, etc.) keyed by slug. The route + page contract stays the same.

const FILE = path.join(process.cwd(), "data", "published.json");

type Entry = { handle: string; slug: string; data: any; updatedAt: string };
type Store = Record<string, Entry>;

const memory: Store = {};

async function readAll(): Promise<Store> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as Store;
  } catch {
    return memory;
  }
}

async function writeAll(store: Store): Promise<void> {
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(store), "utf8");
    Object.keys(memory).forEach((k) => delete memory[k]);
    Object.assign(memory, store);
  } catch {
    Object.keys(memory).forEach((k) => delete memory[k]);
    Object.assign(memory, store);
  }
}

export async function getPublished(slug: string): Promise<Entry | null> {
  const store = await readAll();
  return store[slug] || null;
}

export async function putPublished(entry: Entry): Promise<void> {
  const store = await readAll();
  store[entry.slug] = entry;
  await writeAll(store);
}

export function slugify(handle: string): string {
  return handle
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "anon";
}
