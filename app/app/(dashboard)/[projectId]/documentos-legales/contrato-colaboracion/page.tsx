import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { BackLink } from "@/components/BackLink";

const inputClass =
  "w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent";
const labelClass = "font-mono text-[10px] tracking-widest text-muted uppercase";

export default async function ContratoColaboracionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();
  if (!(await isProjectOwnerPro(project.organizationId))) notFound();

  const [actors, crewMembers] = await Promise.all([
    prisma.actor.findMany({ where: { projectId }, orderBy: { name: "asc" }, select: { name: true } }),
    prisma.crewMember.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { name: true, role: true },
    }),
  ]);
  const people = [
    ...actors.map((a) => a.name),
    ...crewMembers.map((c) => c.name),
  ];

  return (
    <div>
      <BackLink href={`/app/${projectId}/documentos-legales`}>← Documentos legales</BackLink>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Contrato de colaboración
      </h1>
      <p className="mt-2 font-mono text-xs text-muted">
        El nombre del proyecto y la productora se rellenan solos. Completa lo
        demás — al generar el PDF se abre listo para imprimir y firmar.
      </p>

      <form
        action={`/api/pdf/legal/${projectId}/contrato-colaboracion`}
        method="POST"
        target="_blank"
        className="mt-6 grid gap-4 border border-line p-5 sm:grid-cols-2"
      >
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Nombre completo</span>
          <input name="nombre" list="people-list" required className={inputClass} />
          <datalist id="people-list">
            {people.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>DNI / identificación</span>
          <input name="dni" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Rol / función</span>
          <input name="rol" placeholder="Ej. actor protagonista, director de fotografía" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Fechas de colaboración</span>
          <input name="fechas" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Remuneración / contraprestación</span>
          <input name="remuneracion" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Condiciones adicionales</span>
          <input name="condiciones" className={inputClass} />
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
