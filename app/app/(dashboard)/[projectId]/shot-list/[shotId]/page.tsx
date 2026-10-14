import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { deleteShot, updateShot } from "@/lib/actions/shots";
import { DeleteButton } from "@/components/DeleteButton";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { ChipOption } from "@/components/ChipOption";
import { SceneSlug } from "@/components/preproduccion/SceneSlug";
import {
  AngleIcon,
  MovementIcon,
  SHOT_SIZE_NAMES,
  ShotFrame,
  shotSizeKind,
} from "@/components/preproduccion/ShotFrame";

// Ficha de un plano. A la izquierda, el plano como se ve en un guion técnico:
// su encuadre dibujado, tamaño, ángulo, movimiento y estado. A la derecha, el
// formulario en papel (cámara, qué se ve, quién sale) con el botón de guardar
// pegado abajo.

const LABEL = "eyebrow text-muted";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-y-4 border-t border-line px-5 py-7 first:border-t-0 sm:px-8">
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
          intExt: true,
          dayPart: true,
          location: { select: { name: true } },
          characters: { include: { character: true }, orderBy: { character: { name: "asc" } } },
        },
      },
      characters: { select: { characterId: true } },
      shootingDay: { select: { date: true } },
      _count: { select: { storyboard: true } },
    },
  });
  if (!shot) notFound();

  const selectedCharacterIds = new Set(shot.characters.map((c) => c.characterId));
  const updateAction = updateShot.bind(null, projectId, shotId);
  const kind = shotSizeKind(shot.shotSize);
  const inShot = shot.scene.characters.filter(({ character }) => selectedCharacterIds.has(character.id));

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
        description="El encuadre de la izquierda se dibuja solo a partir del tamaño; cámbialo en el formulario."
        actions={
          <Link href={`/app/${projectId}/storyboard`} className="btn btn-outline">
            Ver en Storyboard
          </Link>
        }
      />

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:gap-10">
        <article aria-label={`Plano ${shot.scene.number}.${shot.number}`} className="sheet overflow-hidden lg:sticky lg:top-6">
          <div className="p-5">
            <ShotFrame size={shot.shotSize} className="w-full" />
            <p className="mt-4 flex items-baseline justify-between gap-3">
              <span className="font-display text-xl font-black">
                {kind ? SHOT_SIZE_NAMES[kind] : (shot.shotSize ?? "Sin tamaño")}
              </span>
              {shot.done ? (
                <span className="font-sans text-sm font-semibold text-success">✓ Rodado</span>
              ) : (
                <span className="font-sans text-sm text-muted">Por rodar</span>
              )}
            </p>
            {shot.description && (
              <p className="mt-2 font-sans text-[15px] leading-relaxed">{shot.description}</p>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line px-5 py-4 font-sans text-sm">
            <div>
              <dt className="eyebrow">Ángulo</dt>
              <dd className="mt-1 flex items-center gap-2">
                <AngleIcon angle={shot.angle} />
                {shot.angle ?? <span className="text-muted">—</span>}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Movimiento</dt>
              <dd className="mt-1 flex items-center gap-2">
                <MovementIcon movement={shot.movement} />
                {shot.movement ?? <span className="text-muted">—</span>}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Cámara · lente</dt>
              <dd className="mt-1">
                {[shot.camera, shot.lens].filter(Boolean).join(" · ") || <span className="text-muted">—</span>}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Duración</dt>
              <dd className="mt-1">{shot.durationSec ? `${shot.durationSec} s` : <span className="text-muted">—</span>}</dd>
            </div>
          </dl>
          <div className="space-y-2 border-t border-line px-5 py-4 font-sans text-sm">
            <p>
              <span className="text-muted">Escena {shot.scene.number}: </span>
              <SceneSlug
                intExt={shot.scene.intExt}
                dayPart={shot.scene.dayPart}
                location={shot.scene.location?.name}
                className="text-[13px]"
              />
            </p>
            <p>
              <span className="text-muted">Sale: </span>
              {inShot.length > 0 ? inShot.map(({ character }) => character.name).join(", ") : "nadie marcado"}
            </p>
            <p>
              <span className="text-muted">Día de rodaje: </span>
              {shot.shootingDay
                ? shot.shootingDay.date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
                : "sin planificar"}
              {" · "}
              <Link href={`/app/${projectId}/storyboard`} className="text-accent hover:underline">
                {shot._count.storyboard > 0
                  ? `${shot._count.storyboard} viñeta${shot._count.storyboard === 1 ? "" : "s"}`
                  : "sin viñeta"}
              </Link>
            </p>
          </div>
        </article>

      <form action={updateAction} className="paper min-w-0">
        <Section title="Cámara" hint="Cómo se rueda el plano.">
          <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2 2xl:grid-cols-4">
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
      </div>

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
