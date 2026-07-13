import { NextResponse } from "next/server";
import { loadDirectory } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  // NOTE: In this client-side-only app, data lives in each browser's
  // localStorage. A server route can't see it, so this endpoint is a
  // thin placeholder that returns an empty directory. To publish a
  // shareable page, use the in-app "Publish" flow (see /share), which
  // reads from localStorage and renders read-only. Kept for symmetry.
  const data = loadDirectory();
  return NextResponse.json(data);
}
