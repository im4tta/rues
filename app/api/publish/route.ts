import { NextRequest, NextResponse } from "next/server";
import { putPublished, slugify } from "@/lib/publishStore";
import type { DirectoryData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const handle = (body?.handle || "").toString().trim().replace(/^@/, "");
  const data = body?.data as DirectoryData | undefined;

  if (!handle) return NextResponse.json({ error: "A handle is required" }, { status: 400 });
  if (!data || typeof data !== "object" || !data.devs || !data.repos) {
    return NextResponse.json({ error: "A directory payload is required" }, { status: 400 });
  }

  // Basic sanity caps to avoid absurd payloads.
  const devCount = Object.keys(data.devs).length;
  const repoCount = Object.keys(data.repos).length;
  if (devCount > 5000 || repoCount > 5000) {
    return NextResponse.json({ error: "Directory too large to publish" }, { status: 413 });
  }

  const slug = slugify(handle);
  await putPublished({ handle, slug, data, updatedAt: new Date().toISOString() });
  return NextResponse.json({ slug, handle, url: `/share/${slug}` });
}
