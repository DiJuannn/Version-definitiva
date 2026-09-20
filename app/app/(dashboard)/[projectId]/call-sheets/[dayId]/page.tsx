import { notFound } from "next/navigation";
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

  const callSheet = summary.shootingDay.callSheet;
  const shareToken = summary.shootingDay.shareToken;
  const origin = await getSiteOrigin();
  const updateAction = upsertCallSheet.bind(null, projectId, dayId);
  const generateAction = generateCallSheet.bind(null, projectId, dayId);

  return (
    <div>
      <div className="flex items-center justify-between print:hidden">
        <BackLink href={`/app/${projectId}/call-sheets`}>← Call sheets</BackLink>
        <PdfLink href={`/api/pdf/call-sheet/${dayId}`} />
      </div>

      {!callSheet && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border border-warn/50 p-4 print:hidden">
          <p className="font-mono text-xs text-warn">
            Este call sheet todavía no está generado: lo que ves se calcula del plan de rodaje, pero
            no consta como creado.
          </p>
          <form action={generateAction}>
            <SubmitButton pendingLabel="Generando…" className="btn btn-primary btn-sm">
              Generar call sheet
            </SubmitButton>
          </form>
        </div>
      )}

      <CallSheetShare
        projectId={projectId}
        dayId={dayId}
        link={shareToken ? `${origin}/hoja/${shareToken}` : null}
      />

      <CallSheetView projectName={project.name} summary={summary} />

      <form
        action={updateAction}
        className="mt-8 grid gap-4 border border-line p-5 sm:grid-cols-2 print:hidden"
      >
        <p className="font-mono text-[10px] tracking-widest text-muted uppercase sm:col-span-2">
          Editar campos del call sheet
        </p>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Hora general de llamada
          </span>
          <input
            name="generalCallTime"
            defaultValue={callSheet?.generalCallTime ?? ""}
            placeholder="08:00"
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Transporte
          </span>
          <input
            name="transportNotes"
            defaultValue={callSheet?.transportNotes ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Catering
          </span>
          <input
            name="cateringNotes"
            defaultValue={callSheet?.cateringNotes ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Notas adicionales
          </span>
          <input
            name="additionalNotes"
            defaultValue={callSheet?.additionalNotes ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
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
        <p className="font-mono text-[11px] text-muted sm:col-span-2">
          Con el plan PRO, si el equipo técnico ya recibió el recordatorio de este rodaje, guardar
          cambios les avisa por email de que algo ha cambiado.
        </p>
      </form>
    </div>
  );
}
