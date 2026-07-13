import { NextRequest, NextResponse } from "next/server";
import { getPublished } from "@/lib/publishStore";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const entry = await getPublished(slug);
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(entry);
}
