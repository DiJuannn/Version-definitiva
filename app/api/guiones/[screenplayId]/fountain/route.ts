import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/current-user";
import { getScreenplay, screenplayBlocks } from "@/lib/screenplay-core";
import { toFountain } from "@/lib/screenplay/fountain";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ screenplayId: string }> }) {
  const { screenplayId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const screenplay = await getScreenplay(profile.organizationId, screenplayId);
  if (!screenplay) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const text = toFountain(screenplayBlocks(screenplay.content), {
    title: screenplay.title,
    credit: screenplay.author ? "escrito por" : undefined,
    author: screenplay.author ?? undefined,
    draftDate: screenplay.updatedAt.toISOString().slice(0, 10),
  });
  const name = screenplay.title.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "guion";

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}.fountain`,
      "Cache-Control": "no-store",
    },
  });
}
