import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { deleteShot, updateShot } from "@/lib/actions/shots";
import { DeleteButton } from "@/components/DeleteButton";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { ChipOption } from "@/components/ChipOption";

// Ficha de un plano: una hoja con tres apartados (cámara, qué se ve, quién
// sale) y el botón de guardar pegado abajo.

const LABEL = "eyebrow text-muted";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-x-10 gap-y-4 border-t border-line px-5 py-7 first:border-t-0 sm:px-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <div>
        <h2 className="font-display text-base font-bold">{title}</h2>
        {hint && <p className="mt-1 font-sans text-[13px] leading-relaxed text-muted">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default async function ShotDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; shotId: string }>;
}) {
  const { projectId, shotId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const shot = await prisma.shot.findFirst({
    where: { id: shotId, scene: { projectId } },
    include: {
      scene: {
        select: {
          number: true,
          characters: { include: { character: true }, orderBy: { character: { name: "asc" } } },
        },
      },
      characters: { select: { characterId: true } },
    },
  });
  if (!shot) notFound();

  const selectedCharacterIds = new Set(shot.characters.map((c) => c.characterId));
  const updateAction = updateShot.bind(null, projectId, shotId);

  const fields: Array<[string, string, string, string?]> = [
    ["shotType", "Tipo de plano", shot.shotType ?? "", "Establecimiento, detalle…"],
    ["shotSize", "Tamaño", shot.shotSize ?? "", "PG, PM, PP…"],
    ["angle", "Ángulo", shot.angle ?? "", "Normal, picado…"],
    ["movement", "Movimiento", shot.movement ?? "", "Fijo, travelling…"],
    ["camera", "Cámara", shot.camera ?? "", "A, B…"],
    ["lens", "Lente", shot.lens ?? "", "35mm"],
  ];

  return (
    <div className="pb-16">
      <PageHeader
        backHref={`/app/${projectId}/shot-list`}
        backLabel="← Lista de planos"
        eyebrow={`Escena ${shot.scene.number}`}
        title={`Plano ${shot.scene.number}.${shot.number}`}
        description={shot.description ?? undefined}
        actions={
          <Link href={`/app/${projectId}/storyboard`} className="btn btn-outline">
            Ver en Storyboard
          </Link>
        }
      />

      <form action={updateAction} className="sheet mt-8">
        <Section title="Cámara" hint="Cómo se rueda el plano.">
          <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Número</span>
              <input name="number" defaultValue={shot.number} required className="field" />
            </label>
            {fields.map(([name, label, value, placeholder]) => (
              <label key={name} className="flex flex-col gap-1.5">
                <span className={LABEL}>{label}</span>
                <input name={name} defaultValue={value} placeholder={placeholder} className="field" />
              </label>
            ))}
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>FPS</span>
              <input name="fps" type="number" defaultValue={shot.fps ?? ""} placeholder="24" className="field" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Duración (seg)</span>
              <input name="durationSec" type="number" defaultValue={shot.durationSec ?? ""} className="field" />
            </label>
          </div>
        </Section>

        <Section title="Qué se ve y se oye">
          <div className="grid gap-5">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Descripción</span>
              <textarea name="description" defaultValue={shot.description ?? ""} rows={2} className="field leading-relaxed" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Audio</span>
              <input name="audio" defaultValue={shot.audio ?? ""} placeholder="Directo, wild track, playback…" className="field" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Notas</span>
              <textarea name="notes" defaultValue={shot.notes ?? ""} rows={2} className="field leading-relaxed" />
            </label>
          </div>
        </Section>

        {shot.scene.characters.length > 0 && (
          <Section
            title="Quién sale"
            hint="Solo estos personajes se citan en la hoja de llamada del día en que se rueda este plano, no todo el reparto de la escena."
          >
            <div className="flex flex-wrap gap-2">
              {shot.scene.characters.map(({ character }) => (
                <ChipOption
                  key={character.id}
                  type="checkbox"
                  name="characterIds"
                  value={character.id}
                  label={character.name}
                  defaultChecked={selectedCharacterIds.has(character.id)}
                />
              ))}
            </div>
          </Section>
        )}

        <div className="sticky bottom-0 flex items-center justify-end gap-4 rounded-b-xl border-t border-line bg-bg-raised/95 px-5 py-4 backdrop-blur sm:px-8">
          <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="btn btn-primary">
            Guardar plano
          </SubmitButton>
        </div>
      </form>

      <form action={deleteShot.bind(null, projectId, shotId)} className="mt-6 flex justify-end">
        <DeleteButton
          confirmMessage="¿Eliminar este plano? No se puede deshacer."
          className="link-action hover:text-danger"
        >
          Eliminar plano
        </DeleteButton>
      </form>
    </div>
  );
}
