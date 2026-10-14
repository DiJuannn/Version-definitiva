import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PdfLink } from "@/components/PdfLink";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getShootingDaySummary } from "@/lib/shooting-day-summary";
import { generateCallSheet, upsertCallSheet } from "@/lib/actions/call-sheets";
import { CallSheetView } from "@/components/CallSheetView";
import { CallSheetShare } from "@/components/CallSheetShare";
import { getSiteOrigin } from "@/lib/site-origin";
import { PageHeader } from "@/components/PageHeader";
import { FormField } from "@/components/FormField";
import { PrintButton } from "@/components/PrintButton";
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

  const [allCharacters, allCrewMembers, projectDays] = await Promise.all([
    prisma.character.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.crewMember.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
    prisma.shootingDay.findMany({
      where: { projectId },
      orderBy: { date: "asc" },
      select: { id: true },
    }),
  ]);
  const dayNumber = projectDays.findIndex((d) => d.id === dayId) + 1;

  const callSheet = summary.shootingDay.callSheet;
  const shareToken = summary.shootingDay.shareToken;
  const origin = await getSiteOrigin();
  const updateAction = upsertCallSheet.bind(null, projectId, dayId);
  const generateAction = generateCallSheet.bind(null, projectId, dayId);

  const dayLabel = summary.shootingDay.date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const fields = [
    [
      "generalCallTime",
      "Hora general de llamada",
      callSheet?.generalCallTime,
      "08:00",
    ],
    [
      "transportNotes",
      "Transporte",
      callSheet?.transportNotes,
      "Furgoneta desde…, a las…",
    ],
    [
      "cateringNotes",
      "Catering",
      callSheet?.cateringNotes,
      "Desayuno a las…, comida…",
    ],
    [
      "additionalNotes",
      "Notas para el equipo",
      callSheet?.additionalNotes,
      "Traed abrigo, aparcamiento…",
    ],
  ] as const;

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          backHref={`/app/${projectId}/call-sheets`}
          backLabel="← Hojas de llamada"
          eyebrow={
            dayNumber > 0
              ? `Hoja de llamada · Día ${dayNumber} de ${projectDays.length}`
              : "Hoja de llamada"
          }
          title={dayLabel}
          description="El documento que recibe el equipo la víspera. Se rellena con el plan del día; las horas y quién sale se corrigen aquí mismo, sobre la hoja."
          actions={
            <>
              <PrintButton label="Imprimir" />
              <PdfLink href={`/api/pdf/call-sheet/${dayId}`} />
            </>
          }
        />
      </div>

      {/* Cómo voy: estado de la hoja en una línea. */}
      {callSheet && (
        <p className="mt-6 font-sans text-[15px] text-muted print:hidden">
          <span className="font-semibold text-success">✓ Hoja creada</span>
          {" · "}
          {shareToken ? (
            <span className="text-fg">compartida con enlace</span>
          ) : (
            "aún sin compartir"
          )}
          {" · "}
          {summary.sceneAssignments.length}{" "}
          {summary.sceneAssignments.length === 1 ? "escena" : "escenas"},{" "}
          {summary.characters.length + summary.crewMembers.length} personas
          citadas
          {!callSheet.generalCallTime && (
            <span className="text-warn"> · falta la citación general</span>
          )}
          .
        </p>
      )}

      {!callSheet && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-l-2 border-warn pl-5 print:hidden">
          <p className="max-w-xl font-sans text-sm leading-relaxed">
            <strong className="font-semibold text-warn">
              Esta hoja aún no está generada.
            </strong>{" "}
            Lo que ves se calcula del plan de rodaje, pero todavía no consta
            como creada.
          </p>
          <form action={generateAction}>
            <SubmitButton
              pendingLabel="Generando…"
              className="btn btn-primary btn-sm"
            >
              Generar hoja
            </SubmitButton>
          </form>
        </div>
      )}

      {/* El documento a la izquierda; lo que se toca (compartir, editar) a la
          derecha, sobre la página y sin cajas. Al imprimir solo sale la hoja. */}
      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-12 lg:grid-cols-[minmax(0,1fr)_18rem] print:mt-0 print:block">
        <CallSheetView
          projectName={project.name}
          summary={summary}
          dayNumber={dayNumber > 0 ? dayNumber : undefined}
          totalDays={projectDays.length}
          edit={{
            projectId,
            shootingDayId: dayId,
            allCharacters,
            allCrewMembers,
          }}
        />

        <aside className="min-w-0 space-y-12 print:hidden">
          <CallSheetShare
            projectId={projectId}
            dayId={dayId}
            link={shareToken ? `${origin}/hoja/${shareToken}` : null}
          />

          <form action={updateAction} className="space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold">
                Datos de la hoja
              </h2>
              <p className="mt-1 font-sans text-sm text-muted">
                Lo que no sale del plan de rodaje.
              </p>
            </div>
            {fields.map(([name, label, value, placeholder]) => (
              <FormField key={name} label={label}>
                {name === "generalCallTime" ? (
                  <input
                    name={name}
                    defaultValue={value ?? ""}
                    placeholder={placeholder}
                    className="field w-32"
                  />
                ) : (
                  <textarea
                    name={name}
                    rows={2}
                    defaultValue={value ?? ""}
                    placeholder={placeholder}
                    className="field w-full resize-y"
                  />
                )}
              </FormField>
            ))}
            <SubmitButton
              pendingLabel="Guardando…"
              savedLabel="✓ Guardado"
              className="btn btn-secondary"
            >
              Guardar
            </SubmitButton>
            <p className="font-sans text-xs leading-relaxed text-muted">
              Con el plan PRO, si el equipo ya recibió el recordatorio de este
              rodaje, al guardar cambios les llega un email avisando.
            </p>
          </form>
        </aside>
      </div>

      <p className="mt-16 border-t border-line pt-5 font-sans text-sm text-muted print:hidden">
        Siguiente, el día del rodaje:{" "}
        <Link
          href={`/app/${projectId}/claqueta`}
          className="font-medium text-fg underline decoration-accent/50 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
        >
          Claqueta →
        </Link>{" "}
        — cada toma queda apuntada en el parte de script.
      </p>
    </div>
  );
}
