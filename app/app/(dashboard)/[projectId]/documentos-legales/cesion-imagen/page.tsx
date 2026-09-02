import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { BackLink } from "@/components/BackLink";

const inputClass =
  "w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent";
const labelClass = "font-mono text-[10px] tracking-widest text-muted uppercase";

export default async function CesionImagenPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();
  if (!(await isProjectOwnerPro(project.organizationId))) notFound();

  const actors = await prisma.actor.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
    select: { name: true },
  });

  return (
    <div>
      <BackLink href={`/app/${projectId}/documentos-legales`}>← Plantilla de documentos</BackLink>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Cesión de derechos de imagen
      </h1>
      <p className="mt-2 font-mono text-xs text-muted">
        El nombre del proyecto y la productora se rellenan solos. Completa lo
        demás — al generar el PDF se abre listo para imprimir y firmar.
      </p>

      <form
        action={`/api/pdf/legal/${projectId}/cesion-imagen`}
        method="POST"
        target="_blank"
        className="mt-6 grid gap-4 border border-line p-5 sm:grid-cols-2"
      >
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Nombre completo</span>
          <input name="nombre" list="actors-list" required className={inputClass} />
          <datalist id="actors-list">
            {actors.map((a) => (
              <option key={a.name} value={a.name} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>DNI / identificación</span>
          <input name="dni" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Uso autorizado</span>
          <input
            name="alcance"
            placeholder="Ej. promoción del proyecto en redes y festivales"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Duración</span>
          <input name="duracion" placeholder="Ej. indefinida, o 5 años" className={inputClass} />
        </label>
        <div>
          <button
            type="submit"
            className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Generar PDF
          </button>
        </div>
      </form>
    </div>
  );
}
