import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import type { ScriptAnalysisProposal } from "@/lib/mistral";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/guion/analisis/:analysisId — misma
// propuesta que app/app/(dashboard)/[projectId]/guion/analisis/[analysisId]/page.tsx,
// marcando qué personajes/localizaciones/atrezzo ya existen (para
// desmarcarlos por defecto en la revisión).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; analysisId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, analysisId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const analysis = await prisma.scriptAnalysis.findFirst({
    where: { id: analysisId, projectId },
  });
  if (!analysis) {
    return NextResponse.json(
      { error: "Análisis no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const proposal = analysis.proposedData as unknown as ScriptAnalysisProposal;

  const [existingCharacters, existingLocations, existingProps] = await Promise.all([
    prisma.character.findMany({ where: { projectId }, select: { name: true } }),
    prisma.location.findMany({
      where: { organizationId: project.organizationId },
      select: { name: true },
    }),
    prisma.breakdownElement.findMany({ where: { projectId }, select: { name: true } }),
  ]);

  const existingCharacterNames = new Set(existingCharacters.map((c) => c.name.toLowerCase()));
  const existingLocationNames = new Set(existingLocations.map((l) => l.name.toLowerCase()));
  const existingPropNames = new Set(existingProps.map((p) => p.name.toLowerCase()));

  return NextResponse.json(
    {
      status: analysis.status,
      characters: proposal.characters.map((c) => ({
        ...c,
        exists: existingCharacterNames.has(c.name.toLowerCase()),
      })),
      locations: proposal.locations.map((l) => ({
        ...l,
        exists: existingLocationNames.has(l.name.toLowerCase()),
      })),
      props: proposal.props.map((p) => ({
        ...p,
        exists: existingPropNames.has(p.name.toLowerCase()),
      })),
      scenes: proposal.scenes,
    },
    { headers: CORS_HEADERS },
  );
}
