import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PdfLink } from "@/components/PdfLink";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getShootingDaySummary } from "@/lib/shooting-day-summary";
import { generateCallSheet, upsertCallSheet } from "@/lib/actions/call-sheets";
import { CallSheetView } from "@/components/CallSheetView";
import { CallSheetShare } from "@/components/CallSheetShare";
import { getSiteOrigin } from "@/lib/site-origin";
import { BackLink } from "@/components/BackLink";
import { SubmitButton } from "@/components/SubmitButton";

export default async function CallSheetDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; dayId: string }>;
}) {
  const { projectId, dayId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const summary = await getShootingDaySummary(dayId);
  if (!summary || summary.shootingDay.projectId !== projectId) notFound();

  const [allCharacters, allCrewMembers] = await Promise.all([
    prisma.character.findMany({ where: { projectId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.crewMember.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);

  const callSheet = summary.shootingDay.callSheet;
  const shareToken = summary.shootingDay.shareToken;
  const origin = await getSiteOrigin();
  const updateAction = upsertCallSheet.bind(null, projectId, dayId);
  const generateAction = generateCallSheet.bind(null, projectId, dayId);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink href={`/app/${projectId}/call-sheets`}>← Hojas de llamada</BackLink>
        <div className="flex flex-wrap items-center gap-2">
          <a href="#datos-del-dia" className="btn btn-outline">
            Editar datos del día
          </a>
          <PdfLink href={`/api/pdf/call-sheet/${dayId}`} />
        </div>
      </div>

      {!callSheet && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-warn/50 p-4 print:hidden">
          <p className="text-sm text-warn">
            Esta hoja de llamada todavía no está generada: lo que ves se calcula del plan de rodaje,
            pero no consta como creada.
          </p>
          <form action={generateAction}>
            <SubmitButton pendingLabel="Generando…" className="btn btn-primary btn-sm">
              Generar hoja de llamada
            </SubmitButton>
          </form>
        </div>
      )}

      <CallSheetShare
        projectId={projectId}
        dayId={dayId}
        link={shareToken ? `${origin}/hoja/${shareToken}` : null}
      />

      <CallSheetView
        projectName={project.name}
        summary={summary}
        edit={{ projectId, shootingDayId: dayId, allCharacters, allCrewMembers }}
      />

      <form
        action={updateAction}
        id="datos-del-dia"
        className="mt-10 grid scroll-mt-40 gap-4 rounded-xl border border-line p-5 sm:grid-cols-2 print:hidden"
      >
        <h2 className="text-[1.0625rem] font-bold sm:col-span-2">Datos generales del día</h2>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            Hora general de llamada
          </span>
          <input
            name="generalCallTime"
            defaultValue={callSheet?.generalCallTime ?? ""}
            placeholder="08:00"
            className="rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            Transporte
          </span>
          <input
            name="transportNotes"
            defaultValue={callSheet?.transportNotes ?? ""}
            className="rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            Comida y catering
          </span>
          <input
            name="cateringNotes"
            defaultValue={callSheet?.cateringNotes ?? ""}
            className="rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            Notas adicionales
          </span>
          <input
            name="additionalNotes"
            defaultValue={callSheet?.additionalNotes ?? ""}
            className="rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <div>
          <SubmitButton
            pendingLabel="Guardando…"
            savedLabel="✓ Guardado"
            className="btn btn-secondary"
          >
            Guardar
          </SubmitButton>
        </div>
        <p className="text-xs text-muted sm:col-span-2">
          Con el plan PRO, si el equipo técnico ya recibió el recordatorio de este rodaje, guardar
          cambios les avisa por email de que algo ha cambiado.
        </p>
      </form>
    </div>
  );
}
