import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { deleteScene, updateScene } from "@/lib/actions/scenes";
import {
  BREAKDOWN_CATEGORY_LABELS,
  DAY_PART_LABELS,
  INT_EXT_LABELS,
} from "@/lib/labels";
import { BreakdownCategory, DayPart, IntExt } from "@/lib/generated/prisma";
import { HelpTip } from "@/components/HelpTip";
import { DeleteButton } from "@/components/DeleteButton";
import { ChipOption } from "@/components/ChipOption";
import { BackLink } from "@/components/BackLink";

export default async function SceneDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; sceneId: string }>;
}) {
  const { projectId, sceneId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [scene, locations, characters, breakdownElements, crewMembers] =
    await Promise.all([
      prisma.scene.findFirst({
        where: { id: sceneId, projectId },
        include: {
          characters: { select: { characterId: true } },
          breakdownElements: { select: { breakdownElementId: true, condition: true } },
          crewMembers: { select: { crewMemberId: true } },
        },
      }),
      prisma.location.findMany({
        where: { organizationId: project.organizationId },
        orderBy: { name: "asc" },
      }),
      prisma.character.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
      prisma.breakdownElement.findMany({
        where: { projectId },
        orderBy: { name: "asc" },
      }),
      prisma.crewMember.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
    ]);

  if (!scene) notFound();

  const selectedCharacterIds = new Set(
    scene.characters.map((c) => c.characterId),
  );
  const selectedBreakdownIds = new Set(
    scene.breakdownElements.map((b) => b.breakdownElementId),
  );
  const conditionByBreakdownId = new Map(
    scene.breakdownElements.map((b) => [b.breakdownElementId, b.condition ?? ""]),
  );
  const selectedCrewIds = new Set(scene.crewMembers.map((c) => c.crewMemberId));

  const breakdownByCategory = Object.values(BreakdownCategory).map(
    (category) => ({
      category,
      items: breakdownElements.filter((el) => el.category === category),
    }),
  );

  const updateAction = updateScene.bind(null, projectId, sceneId);

  return (
    <div>
      <BackLink href={`/app/${projectId}/guion`}>← Guion</BackLink>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Escena {scene.number}
      </h1>

      <form action={updateAction} className="mt-8 space-y-8">
        <div className="grid gap-4 border border-line p-5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Número
            </span>
            <input
              name="number"
              defaultValue={scene.number}
              required
              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              INT/EXT
            </span>
            <div className="flex flex-wrap gap-2">
              {Object.values(IntExt).map((value) => (
                <ChipOption
                  key={value}
                  type="radio"
                  name="intExt"
                  value={value}
                  label={INT_EXT_LABELS[value]}
                  defaultChecked={scene.intExt === value}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Día/Noche
            </span>
            <div className="flex flex-wrap gap-2">
              {Object.values(DayPart).map((value) => (
                <ChipOption
                  key={value}
                  type="radio"
                  name="dayPart"
                  value={value}
                  label={DAY_PART_LABELS[value]}
                  defaultChecked={scene.dayPart === value}
                />
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Localización
            </span>
            <select
              name="locationId"
              defaultValue={scene.locationId ?? ""}
              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            >
              <option value="" className="bg-bg">
                Sin localización
              </option>
              {locations.map((location) => (
                <option key={location.id} value={location.id} className="bg-bg">
                  {location.name}
                </option>
              ))}
            </select>
            {locations.length === 0 && (
              <span className="font-mono text-[10px] text-muted">
                <Link href="/app/localizaciones" className="text-fg hover:text-accent">
                  Añadir en Localizaciones →
                </Link>
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-1 font-mono text-[10px] tracking-widest text-muted uppercase">
              Orden en la historia
              <HelpTip text="Solo hace falta rellenarlo si esta escena no ocurre en el mismo orden en que aparece en el guion (por ejemplo, un flashback). Si se deja vacío, se usa el orden del guion tal cual." />
            </span>
            <input
              name="storyOrder"
              type="number"
              placeholder={String(scene.order)}
              defaultValue={scene.storyOrder ?? ""}
              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Descripción
            </span>
            <textarea
              name="description"
              defaultValue={scene.description ?? ""}
              rows={2}
              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Acción
            </span>
            <textarea
              name="action"
              defaultValue={scene.action ?? ""}
              rows={2}
              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Diálogos / notas
            </span>
            <textarea
              name="dialogueNotes"
              defaultValue={scene.dialogueNotes ?? ""}
              rows={2}
              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Extras
            </span>
            <textarea
              name="extrasNotes"
              defaultValue={scene.extrasNotes ?? ""}
              rows={2}
              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Notas de producción
            </span>
            <textarea
              name="productionNotes"
              defaultValue={scene.productionNotes ?? ""}
              rows={2}
              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>
        </div>

        <div className="border border-line p-5">
          <span className="font-mono text-[10px] tracking-widest text-accent uppercase">
            Personajes
          </span>
          {characters.length === 0 ? (
            <p className="mt-3 font-mono text-xs text-muted">
              No hay personajes en el proyecto todavía.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {characters.map((character) => (
                <label
                  key={character.id}
                  className="flex items-center gap-2 font-mono text-xs"
                >
                  <input
                    type="checkbox"
                    name="characterIds"
                    value={character.id}
                    defaultChecked={selectedCharacterIds.has(character.id)}
                  />
                  {character.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="border border-line p-5">
          <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-accent uppercase">
            Desglose
            <HelpTip text="El campo 'Estado' es opcional — solo rellénalo si en esta escena concreta el objeto está roto, perdido, manchado, etc. Ayuda al detector de continuidad a avisar si luego aparece intacto sin explicación." />
          </span>
          {breakdownElements.length === 0 ? (
            <p className="mt-3 font-mono text-xs text-muted">
              Todavía no hay elementos de desglose en el proyecto.{" "}
              <Link
                href={`/app/${projectId}/desglose`}
                className="text-fg hover:text-accent"
              >
                Añadir en Desglose →
              </Link>
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {breakdownByCategory
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.category}>
                    <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                      {BREAKDOWN_CATEGORY_LABELS[group.category]}
                    </p>
                    <div className="mt-2 flex flex-col gap-1.5">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 font-mono text-xs"
                        >
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              name="breakdownElementIds"
                              value={item.id}
                              defaultChecked={selectedBreakdownIds.has(item.id)}
                            />
                            {item.name}
                          </label>
                          <input
                            name={`condition_${item.id}`}
                            placeholder="Estado (opcional)"
                            defaultValue={conditionByBreakdownId.get(item.id) ?? ""}
                            className="w-36 border border-line bg-transparent px-2 py-1 text-[11px] outline-none transition-colors focus:border-accent"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="border border-line p-5">
          <span className="font-mono text-[10px] tracking-widest text-accent uppercase">
            Equipo técnico
          </span>
          {crewMembers.length === 0 ? (
            <p className="mt-3 font-mono text-xs text-muted">
              Todavía no hay equipo técnico en el proyecto.{" "}
              <Link
                href={`/app/${projectId}/desglose`}
                className="text-fg hover:text-accent"
              >
                Añadir en Desglose →
              </Link>
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {crewMembers.map((member) => (
                <label
                  key={member.id}
                  className="flex items-center gap-2 font-mono text-xs"
                >
                  <input
                    type="checkbox"
                    name="crewMemberIds"
                    value={member.id}
                    defaultChecked={selectedCrewIds.has(member.id)}
                  />
                  {member.name}
                  {member.role ? ` (${member.role})` : ""}
                </label>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
        >
          Guardar
        </button>
      </form>

      <form action={deleteScene.bind(null, projectId, sceneId)} className="mt-6">
        <DeleteButton
          confirmMessage="¿Eliminar esta escena? No se puede deshacer."
          className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
        >
          Eliminar escena
        </DeleteButton>
      </form>
    </div>
  );
}
