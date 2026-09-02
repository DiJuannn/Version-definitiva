import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { BackLink } from "@/components/BackLink";

const inputClass =
  "w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent";
const labelClass = "font-mono text-[10px] tracking-widest text-muted uppercase";

export default async function AutorizacionMenorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();
  if (!(await isProjectOwnerPro(project.organizationId))) notFound();

  return (
    <div>
      <BackLink href={`/app/${projectId}/documentos-legales`}>← Documentos legales</BackLink>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Autorización de menor en pantalla
      </h1>
      <p className="mt-2 font-mono text-xs text-muted">
        El nombre del proyecto y la productora se rellenan solos. Completa lo
        demás — al generar el PDF se abre listo para imprimir y firmar. Revisa
        siempre este documento con asesoría legal antes de usarlo.
      </p>

      <form
        action={`/api/pdf/legal/${projectId}/autorizacion-menor`}
        method="POST"
        target="_blank"
        className="mt-6 grid gap-4 border border-line p-5 sm:grid-cols-2"
      >
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClass}>Nombre completo del menor</span>
          <input name="nombreMenor" required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Nombre del tutor o tutora legal</span>
          <input name="nombreTutor" required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>DNI del tutor o tutora</span>
          <input name="dniTutor" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Relación con el menor</span>
          <input name="relacion" placeholder="Ej. madre, padre, tutor legal" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClass}>Condiciones específicas</span>
          <textarea
            name="condiciones"
            rows={3}
            placeholder="Ej. horario limitado, presencia del tutor en el set..."
            className={inputClass}
          />
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
