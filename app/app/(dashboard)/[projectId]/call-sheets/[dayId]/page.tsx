import { notFound } from "next/navigation";
import { PdfLink } from "@/components/PdfLink";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getShootingDaySummary } from "@/lib/shooting-day-summary";
import { generateCallSheet, upsertCallSheet } from "@/lib/actions/call-sheets";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
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

      <div className="mt-6 border border-line bg-bg-raised/40 p-6 sm:p-10">
        <div className="flex items-baseline justify-between gap-4 border-b border-accent/40 pb-5">
          <div>
            <p className="font-mono text-xs tracking-widest text-accent uppercase">
              Call sheet
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-black tracking-tight uppercase sm:text-4xl">
              {project.name}
            </h1>
          </div>
          <p className="font-mono text-sm">
            {summary.shootingDay.date.toLocaleDateString("es-ES", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Hora general de llamada
            </p>
            <p className="mt-1 font-mono text-sm">
              {callSheet?.generalCallTime ?? "—"}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Localizaciones
            </p>
            <p className="mt-1 font-mono text-sm">
              {summary.locations.map((l) => l.name).join(", ") || "—"}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Escenas
          </p>
          <div className="mt-3 border-t border-line">
            {summary.sceneAssignments.length === 0 ? (
              <p className="py-4 font-mono text-sm text-muted">
                Sin escenas asignadas todavía.
              </p>
            ) : (
              summary.sceneAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="grid grid-cols-[auto_1fr_auto] items-baseline gap-4 border-b border-line py-3"
                >
                  <span className="font-mono text-sm">
                    {assignment.callTime ?? "—"}
                  </span>
                  <span className="font-mono text-sm">
                    Escena {assignment.scene.number} —{" "}
                    {INT_EXT_LABELS[assignment.scene.intExt]}{" "}
                    {DAY_PART_LABELS[assignment.scene.dayPart]}
                    {assignment.scene.location
                      ? ` · ${assignment.scene.location.name}`
                      : ""}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {assignment.scene.characters.map((c) => c.character.name).join(", ")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Cast
            </p>
            <p className="mt-1 font-mono text-sm">
              {summary.characters
                .map((c) => `${c.name}${c.actor ? ` (${c.actor.name})` : ""}`)
                .join(", ") || "—"}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Equipo técnico
            </p>
            <p className="mt-1 font-mono text-sm">
              {summary.crewMembers.map((c) => c.name).join(", ") || "—"}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Atrezzo / equipo
            </p>
            <p className="mt-1 font-mono text-sm">
              {summary.breakdownElements.map((b) => b.name).join(", ") || "—"}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          <div>
            <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Transporte
            </p>
            <p className="mt-1 font-mono text-sm">
              {callSheet?.transportNotes ?? "—"}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Catering
            </p>
            <p className="mt-1 font-mono text-sm">
              {callSheet?.cateringNotes ?? "—"}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Notas adicionales
            </p>
            <p className="mt-1 font-mono text-sm">
              {callSheet?.additionalNotes ?? "—"}
            </p>
          </div>
        </div>
      </div>

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
