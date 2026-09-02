import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { BackLink } from "@/components/BackLink";

const inputClass =
  "w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent";
const labelClass = "font-mono text-[10px] tracking-widest text-muted uppercase";

export default async function PermisoRodajePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();
  if (!(await isProjectOwnerPro(project.organizationId))) notFound();

  const locations = await prisma.location.findMany({
    where: { organizationId: project.organizationId },
    orderBy: { name: "asc" },
    select: { name: true, address: true },
  });

  return (
    <div>
      <BackLink href={`/app/${projectId}/documentos-legales`}>← Plantilla de documentos</BackLink>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Permiso de rodaje
      </h1>
      <p className="mt-2 font-mono text-xs text-muted">
        El nombre del proyecto y la productora se rellenan solos. Completa lo
        demás — al generar el PDF se abre listo para imprimir y firmar.
      </p>

      <form
        action={`/api/pdf/legal/${projectId}/permiso-rodaje`}
        method="POST"
        target="_blank"
        className="mt-6 grid gap-4 border border-line p-5 sm:grid-cols-2"
      >
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Localización</span>
          <input name="localizacion" list="locations-list" required className={inputClass} />
          <datalist id="locations-list">
            {locations.map((l) => (
              <option key={l.name} value={l.name} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Dirección</span>
          <input name="direccion" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Fechas de rodaje</span>
          <input name="fechas" placeholder="Ej. 12-14 de octubre de 2026" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Horario</span>
          <input name="horario" placeholder="Ej. 08:00 - 20:00" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Nombre de quien autoriza</span>
          <input name="nombreAutoriza" required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>DNI / identificación</span>
          <input name="dniAutoriza" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClass}>Condiciones especiales</span>
          <textarea name="condiciones" rows={3} className={inputClass} />
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
