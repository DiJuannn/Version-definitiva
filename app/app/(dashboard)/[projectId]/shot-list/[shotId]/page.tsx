import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { deleteShot, updateShot } from "@/lib/actions/shots";
import { DeleteButton } from "@/components/DeleteButton";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";

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
    include: { scene: { select: { number: true } } },
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
      <PageHeader
        backHref={`/app/${projectId}/shot-list`}
        backLabel="← Shot list"
        title={`Plano ${shot.scene.number}.${shot.number}`}
      />

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
          <SubmitButton
            pendingLabel="Guardando…"
            savedLabel="✓ Guardado"
            className="btn btn-secondary"
          >
            Guardar
          </SubmitButton>
        </div>
      </form>

      <div className="mt-6 flex items-center gap-6">
        <Link
          href={`/app/${projectId}/storyboard`}
          className="link-action"
        >
          Ver en Storyboard →
        </Link>
        <form action={deleteShot.bind(null, projectId, shotId)}>
          <DeleteButton
            confirmMessage="¿Eliminar este plano? No se puede deshacer."
            className="link-action"
          >
            Eliminar plano
          </DeleteButton>
        </form>
      </div>
    </div>
  );
}
