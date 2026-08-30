import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { importScriptAnalysis } from "@/lib/actions/script-analysis";
import { SubmitButton } from "@/components/SubmitButton";
import type { ScriptAnalysisProposal } from "@/lib/mistral";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import { DayPart, IntExt } from "@/lib/generated/prisma";

export default async function ScriptAnalysisReviewPage({
  params,
}: {
  params: Promise<{ projectId: string; analysisId: string }>;
}) {
  const { projectId, analysisId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const analysis = await prisma.scriptAnalysis.findFirst({
    where: { id: analysisId, projectId },
  });
  if (!analysis) notFound();

  const proposal = analysis.proposedData as unknown as ScriptAnalysisProposal;

  const [existingCharacters, existingLocations, existingProps] = await Promise.all([
    prisma.character.findMany({ where: { projectId } }),
    prisma.location.findMany({ where: { organizationId: project.organizationId } }),
    prisma.breakdownElement.findMany({ where: { projectId, category: "PROP" } }),
  ]);

  const existingCharacterNames = new Set(
    existingCharacters.map((c) => c.name.toLowerCase()),
  );
  const existingLocationNames = new Set(
    existingLocations.map((l) => l.name.toLowerCase()),
  );
  const existingPropNames = new Set(existingProps.map((p) => p.name.toLowerCase()));

  const importAction = importScriptAnalysis.bind(null, projectId, analysisId);

  return (
    <div>
      <Link
        href={`/app/${projectId}/guion`}
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        ← Guion
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Revisar análisis de IA
      </h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Nada de esto se guarda todavía. Desmarca lo que no quieras importar y
        pulsa &ldquo;Importar seleccionados&rdquo; al final.
      </p>

      <form action={importAction}>
        <section className="mt-8">
          <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
            Personajes ({proposal.characters.length})
          </h2>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {proposal.characters.map((character, i) => {
              const exists = existingCharacterNames.has(character.name.toLowerCase());
              return (
                <label
                  key={`${character.name}-${i}`}
                  className="flex items-center gap-2 font-mono text-xs"
                >
                  <input
                    type="checkbox"
                    name={`character_${i}`}
                    defaultChecked={!exists}
                  />
                  {character.name}
                  {exists && <span className="text-muted">(ya existe)</span>}
                </label>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
            Localizaciones ({proposal.locations.length})
          </h2>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {proposal.locations.map((location, i) => {
              const exists = existingLocationNames.has(location.name.toLowerCase());
              return (
                <label
                  key={`${location.name}-${i}`}
                  className="flex items-center gap-2 font-mono text-xs"
                >
                  <input
                    type="checkbox"
                    name={`location_${i}`}
                    defaultChecked={!exists}
                  />
                  {location.name}
                  {exists && <span className="text-muted">(ya existe)</span>}
                </label>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
            Atrezzo ({proposal.props.length})
          </h2>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {proposal.props.map((prop, i) => {
              const exists = existingPropNames.has(prop.name.toLowerCase());
              return (
                <label
                  key={`${prop.name}-${i}`}
                  className="flex items-center gap-2 font-mono text-xs"
                >
                  <input type="checkbox" name={`prop_${i}`} defaultChecked={!exists} />
                  {prop.name}
                  {exists && <span className="text-muted">(ya existe)</span>}
                </label>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
            Escenas ({proposal.scenes.length})
          </h2>
          <div className="mt-4 space-y-4">
            {proposal.scenes.map((scene, i) => (
              <div key={`${scene.number}-${i}`} className="border border-line p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    name={`scene_${i}`}
                    defaultChecked
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-display text-sm font-bold uppercase">
                      Escena {scene.number}
                      {scene.intExt && (Object.values(IntExt) as string[]).includes(scene.intExt)
                        ? ` — ${INT_EXT_LABELS[scene.intExt as IntExt]}`
                        : ""}
                      {scene.dayPart && (Object.values(DayPart) as string[]).includes(scene.dayPart)
                        ? ` · ${DAY_PART_LABELS[scene.dayPart as DayPart]}`
                        : ""}
                      {scene.locationName ? ` · ${scene.locationName}` : ""}
                    </p>
                    {scene.description && (
                      <p className="mt-1 font-mono text-xs text-muted">
                        {scene.description}
                      </p>
                    )}
                    {scene.action && (
                      <p className="mt-1 font-mono text-xs">{scene.action}</p>
                    )}
                    {scene.dialogueNotes && (
                      <p className="mt-1 font-mono text-xs text-muted">
                        {scene.dialogueNotes}
                      </p>
                    )}
                    <p className="mt-2 font-mono text-[11px] text-muted">
                      {[
                        scene.characterNames?.length
                          ? `Personajes: ${scene.characterNames.join(", ")}`
                          : null,
                        scene.propNames?.length
                          ? `Atrezzo: ${scene.propNames.join(", ")}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </label>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-10">
          <SubmitButton
            pendingLabel="Importando…"
            className="rounded-full bg-fg px-6 py-2.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Importar seleccionados
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
