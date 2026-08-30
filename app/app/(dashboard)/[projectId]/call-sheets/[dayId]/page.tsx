import { notFound } from "next/navigation";
import { PdfLink } from "@/components/PdfLink";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getShootingDaySummary } from "@/lib/shooting-day-summary";
import { upsertCallSheet } from "@/lib/actions/call-sheets";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import { BackLink } from "@/components/BackLink";

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

  return (
    <div>
      <div className="flex items-center justify-between print:hidden">
        <BackLink href={`/app/${projectId}/call-sheets`}>← Call sheets</BackLink>
        <PdfLink href={`/api/pdf/call-sheet/${dayId}`} />
      </div>

      <div className="mt-6 border border-line p-6 sm:p-8">
        <div className="flex items-baseline justify-between border-b border-line pb-4">
          <div>
            <p className="font-mono text-xs tracking-widest text-accent uppercase">
              Call sheet
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold uppercase">
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
          <button
            type="submit"
            className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
