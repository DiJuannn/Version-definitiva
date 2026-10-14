import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentProfile } from "@/lib/current-user";
import { getScreenplay, screenplayBlocks } from "@/lib/screenplay-core";
import { ScreenplayDocument } from "@/lib/pdf/ScreenplayDocument";

const fileName = (title: string) => title.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "guion";

export async function GET(request: NextRequest, { params }: { params: Promise<{ screenplayId: string }> }) {
  const { screenplayId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const screenplay = await getScreenplay(profile.organizationId, screenplayId);
  if (!screenplay) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const size = request.nextUrl.searchParams.get("size") === "LETTER" ? "LETTER" : "A4";
  const draftDate = new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "Europe/Madrid" }).format(
    screenplay.updatedAt,
  );

  // El guion es del equipo que lo escribe: sale siempre limpio, sin marca de agua.
  const buffer = await renderToBuffer(
    <ScreenplayDocument
      title={screenplay.title}
      author={screenplay.author}
      blocks={screenplayBlocks(screenplay.content)}
      size={size}
      draftDate={draftDate}
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName(screenplay.title))}.pdf`,
      "Cache-Control": "no-store",
    },
  });
}
