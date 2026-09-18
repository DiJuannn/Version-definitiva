import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { PageHeader } from "@/components/PageHeader";

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
      <PageHeader
        backHref={`/app/${projectId}/documentos-legales`}
        backLabel="← Plantilla de documentos"
        title="Contrato de colaboración"
      />
      <p className="mt-3 max-w-2xl font-sans text-sm text-muted">
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
            className="btn btn-secondary"
          >
            Generar PDF
          </button>
        </div>
      </form>
    </div>
  );
}
