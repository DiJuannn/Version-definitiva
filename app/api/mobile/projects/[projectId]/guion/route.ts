import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { isPro } from "@/lib/plan";
import { INT_EXT_LABELS, DAY_PART_LABELS } from "@/lib/labels";
import {
  SCRIPT_ANALYSIS_FREE_DAILY_LIMIT,
  SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT,
  SCRIPT_ANALYSIS_PRO_DAILY_LIMIT,
} from "@/lib/limits";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/guion — misma información que
// app/app/(dashboard)/[projectId]/guion/page.tsx: escenas, archivo del
// guion, análisis pendientes de revisar y estado del detector de
// continuidad.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const [scenes, scriptFiles, pendingAnalyses, pendingContinuityChecks, isProjectPro] =
    await Promise.all([
      prisma.scene.findMany({
        where: { projectId },
        orderBy: [{ order: "asc" }, { number: "asc" }],
        select: {
          id: true,
          number: true,
          intExt: true,
          dayPart: true,
          location: { select: { name: true } },
          _count: { select: { characters: true } },
        },
      }),
      prisma.scriptFile.findMany({
        where: { projectId },
        orderBy: { uploadedAt: "desc" },
        take: 1,
      }),
      prisma.scriptAnalysis.findMany({
        where: { projectId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true },
      }),
      prisma.continuityCheck.findMany({
        where: { projectId, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, _count: { select: { issues: true } } },
      }),
      isProjectOwnerPro(project.organizationId),
    ]);

  const accountIsPro = isPro(profile.organization.plan);

  return NextResponse.json(
    {
      scenes: scenes.map((scene) => ({
        id: scene.id,
        number: scene.number,
        intExtLabel: INT_EXT_LABELS[scene.intExt],
        dayPartLabel: DAY_PART_LABELS[scene.dayPart],
        locationName: scene.location?.name ?? null,
        charactersCount: scene._count.characters,
      })),
      scriptFile: scriptFiles[0]
        ? { id: scriptFiles[0].id, fileName: scriptFiles[0].fileName, fileUrl: scriptFiles[0].fileUrl }
        : null,
      pendingAnalyses: pendingAnalyses.map((a) => ({ id: a.id, createdAt: a.createdAt })),
      pendingContinuityChecks: pendingContinuityChecks.map((c) => ({
        id: c.id,
        createdAt: c.createdAt,
        issuesCount: c._count.issues,
      })),
      isProjectPro,
      scriptAnalysisLimits: {
        isPro: accountIsPro,
        dailyLimit: accountIsPro ? SCRIPT_ANALYSIS_PRO_DAILY_LIMIT : SCRIPT_ANALYSIS_FREE_DAILY_LIMIT,
        lifetimeLimit: accountIsPro ? null : SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT,
      },
    },
    { headers: CORS_HEADERS },
  );
}
