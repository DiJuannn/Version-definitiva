import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { deleteShot, updateShot } from "@/lib/actions/shots";
import { DeleteButton } from "@/components/DeleteButton";
import { BackLink } from "@/components/BackLink";

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
    include: { scene: true },
  });
  if (!shot) notFound();

  const updateAction = updateShot.bind(null, projectId, shotId);

  const fields: Array<[string, string, string]> = [
    ["shotType", "Tipo de plano", shot.shotType ?? ""],
    ["shotSize", "Tamaño", shot.shotSize ?? ""],
    ["angle", "Ángulo", shot.angle ?? ""],
    ["movement", "Movimiento", shot.movement ?? ""],
    ["camera", "Cámara", shot.camera ?? ""],
    ["lens", "Lente", shot.lens ?? ""],
  ];

  return (
    <div>
      <BackLink href={`/app/${projectId}/shot-list`}>← Shot list</BackLink>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Plano {shot.scene.number}.{shot.number}
      </h1>

      <form
        action={updateAction}
        className="mt-8 grid gap-4 border border-line p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Número
          </span>
          <input
            name="number"
            defaultValue={shot.number}
            required
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        {fields.map(([name, label, value]) => (
          <label key={name} className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
              {label}
            </span>
            <input
              name={name}
              defaultValue={value}
              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            />
          </label>
        ))}
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            FPS
          </span>
          <input
            name="fps"
            type="number"
            defaultValue={shot.fps ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Duración (seg)
          </span>
          <input
            name="durationSec"
            type="number"
            defaultValue={shot.durationSec ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Descripción
          </span>
          <textarea
            name="description"
            defaultValue={shot.description ?? ""}
            rows={2}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Audio
          </span>
          <input
            name="audio"
            defaultValue={shot.audio ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Notas
          </span>
          <textarea
            name="notes"
            defaultValue={shot.notes ?? ""}
            rows={2}
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

      <div className="mt-6 flex items-center gap-6">
        <Link
          href={`/app/${projectId}/storyboard`}
          className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
        >
          Ver en Storyboard →
        </Link>
        <form action={deleteShot.bind(null, projectId, shotId)}>
          <DeleteButton
            confirmMessage="¿Eliminar este plano? No se puede deshacer."
            className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
          >
            Eliminar plano
          </DeleteButton>
        </form>
      </div>
    </div>
  );
}
