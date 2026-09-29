import type { Metadata } from "next";
import { orNotFound } from "@/lib/http/page";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { getBrief } from "@/lib/services/brief";
import { Chip } from "@/components/ui/chip";
import { Notice, PageHeader } from "@/components/ui/misc";
import { briefCompleteness, briefSections } from "@/lib/domain/brief";
import { STYLE_FIELDS, parseStyleData } from "@/lib/domain/style";
import { fmtRelative } from "@/lib/format";
import { BriefForm } from "./brief-form";

export const metadata: Metadata = { title: "Brief" };

export default async function BriefPage(props: PageProps<"/proyectos/[projectId]/brief">) {
  const me = await requireUser();
  const { projectId } = await props.params;
  const { brief, data, missing } = await orNotFound(getBrief(me, projectId));
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { name: true, clientId: true, styleProfile: true } });
  const canEdit = me.role === "ADMIN" || me.role === "COORDINATOR" || (me.role === "CLIENT" && me.clientId === project.clientId);
  const style = parseStyleData(project.styleProfile?.data);
  const header = (
    <PageHeader
      eyebrow={<Link href={`/proyectos/${projectId}`} className="hover:text-ink">{project.name}</Link>}
      title="Brief"
      meta={
        <>
          <Chip tone={brief?.status === "SUBMITTED" ? "success" : "attention"}>{brief?.status === "SUBMITTED" ? "Enviado" : "Borrador"}</Chip>
          <span className="text-ink-3">{briefCompleteness(data)} % completo</span>
          {brief?.updatedAt && <span className="text-ink-3">· Guardado {fmtRelative(brief.updatedAt)}</span>}
        </>
      }
    />
  );

  if (!canEdit) {
    // Vista limpia para el editor: solo lo que hay, agrupado, más el perfil de estilo congelado.
    return (
      <>
        {header}
        {missing.length > 0 && (
          <div className="mb-5">
            <Notice tone="attention" title="Información pendiente">
              Falta: {missing.map((m) => m.label.toLowerCase()).join(", ")}. Pregunta a coordinación antes de asumir.
            </Notice>
          </div>
        )}
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <article className="rounded-lg border border-line bg-surface">
            {briefSections().map(([section, fields]) => {
              const filled = fields.filter((f) => data[f.key]);
              if (!filled.length) return null;
              return (
                <section key={section} className="border-b border-line px-5 py-4 last:border-0">
                  <h2 className="mb-2 text-[12px] font-semibold tracking-wider text-ink-3 uppercase">{section}</h2>
                  <dl className="flex flex-col gap-3">
                    {filled.map((f) => (
                      <div key={f.key}>
                        <dt className="text-[13px] font-medium">{f.label}</dt>
                        <dd className="text-sm whitespace-pre-line text-ink-2">{data[f.key]}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })}
          </article>
          <aside className="rounded-lg border border-line bg-surface">
            <h2 className="border-b border-line px-4 py-3 text-[15px] font-semibold">Estilo del cliente {project.styleProfile && <span className="font-normal text-ink-3">· v{project.styleProfile.version}</span>}</h2>
            {project.styleProfile ? (
              <dl className="divide-y divide-line">
                {STYLE_FIELDS.filter((f) => style[f.key]).map((f) => (
                  <div key={f.key} className="px-4 py-2 text-[13px]">
                    <dt className="text-ink-3">{f.label}</dt>
                    <dd className="whitespace-pre-line">{style[f.key]}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="px-4 py-3 text-[13px] text-ink-3">Sin perfil de estilo.</p>
            )}
          </aside>
        </div>
      </>
    );
  }
  return (
    <>
      {header}
      <BriefForm projectId={projectId} data={data} submitted={brief?.status === "SUBMITTED"} />
    </>
  );
}
