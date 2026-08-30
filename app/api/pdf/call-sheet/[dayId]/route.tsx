import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getShootingDaySummary } from "@/lib/shooting-day-summary";
import { CallSheetDocument } from "@/lib/pdf/CallSheetDocument";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dayId: string }> },
) {
  const { dayId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const profile = await prisma.user.findUnique({ where: { id: user.id } });
  if (!profile) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const summary = await getShootingDaySummary(dayId);
  if (!summary) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const project = await prisma.project.findFirst({
    where: { id: summary.shootingDay.projectId, organizationId: profile.organizationId },
  });
  if (!project) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const buffer = await renderToBuffer(
    <CallSheetDocument projectName={project.name} summary={summary} />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="call-sheet-${summary.shootingDay.date.toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
