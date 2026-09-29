import type { Metadata } from "next";
import { orNotFound } from "@/lib/http/page";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { getClient } from "@/lib/services/clients";
import { decideSuggestionAction, refreshSuggestionsAction } from "@/app/actions/admin";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState, PageHeader, Section } from "@/components/ui/misc";
import { PROJECT_STATUS } from "@/lib/domain/labels";
import { STYLE_FIELDS, parseStyleData } from "@/lib/domain/style";
import { fmtDate } from "@/lib/format";
import { StyleForm } from "./style-form";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientPage(props: PageProps<"/clientes/[clientId]">) {
  const me = await requireUser(["ADMIN", "COORDINATOR"]);
  const { clientId } = await props.params;
  const c = await orNotFound(getClient(me, clientId));
  const latest = c.styleProfiles[0];
  const data = parseStyleData(latest?.data);
  return (
    <>
      <PageHeader
        eyebrow={<Link href="/clientes" className="hover:text-ink">Clientes</Link>}
        title={c.name}
        meta={<span>{[c.contactName, c.contactEmail].filter(Boolean).join(" · ")}</span>}
        actions={<ButtonLink href={`/proyectos/nuevo?cliente=${c.id}`} variant="primary">Nuevo proyecto</ButtonLink>}
      />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Section
          title="Perfil de estilo"
          description={latest ? `Versión ${latest.version} · ${fmtDate(latest.createdAt)}. Guardar crea una versión nueva; los proyectos anteriores no cambian.` : "Todavía no hay perfil."}
        >
          <StyleForm clientId={c.id} data={data} />
        </Section>
        <div className="flex flex-col gap-5">
          <Section
            title="Sugerencias de reglas"
            description="Detectadas por repetición en correcciones (reglas simples, no IA). Nada entra en el perfil sin tu confirmación."
            actions={
              <form action={refreshSuggestionsAction}>
                <input type="hidden" name="clientId" value={c.id} />
                <button className={buttonClass("secondary", "sm")}>Analizar correcciones</button>
              </form>
            }
          >
            {c.styleSuggestions.length ? (
              <ul className="divide-y divide-line">
                {c.styleSuggestions.map((s) => (
                  <li key={s.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
                    <p>{s.text}</p>
                    <p className="text-[12px] text-ink-3">
                      Campo: {STYLE_FIELDS.find((f) => f.key === s.field)?.label} · {((s.evidence as { correctionIds?: string[] })?.correctionIds ?? []).length} correcciones como evidencia
                    </p>
                    <div className="flex gap-2">
                      <form action={decideSuggestionAction}>
                        <input type="hidden" name="suggestionId" value={s.id} />
                        <input type="hidden" name="clientId" value={c.id} />
                        <input type="hidden" name="accept" value="true" />
                        <button className={buttonClass("primary", "sm")}>Añadir al perfil</button>
                      </form>
                      <form action={decideSuggestionAction}>
                        <input type="hidden" name="suggestionId" value={s.id} />
                        <input type="hidden" name="clientId" value={c.id} />
                        <input type="hidden" name="accept" value="false" />
                        <button className={buttonClass("ghost", "sm")}>Descartar</button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Sin sugerencias pendientes" />
            )}
          </Section>
          <Section title="Proyectos">
            {c.projects.length ? (
              <ul className="divide-y divide-line">
                {c.projects.map((p) => (
                  <li key={p.id} className="relative flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface-2">
                    <Link href={`/proyectos/${p.id}`} className="flex-1 truncate after:absolute after:inset-0">{p.name}</Link>
                    {p.styleProfile && <span className="text-[12px] text-ink-3">estilo v{p.styleProfile.version}</span>}
                    <Chip tone={PROJECT_STATUS[p.status].tone}>{PROJECT_STATUS[p.status].label}</Chip>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Sin proyectos" />
            )}
          </Section>
          <Section title="Accesos al portal" description="Usuarios con rol Cliente. Se crean en Ajustes.">
            {c.users.length ? (
              <ul className="divide-y divide-line">
                {c.users.map((u) => (
                  <li key={u.id} className="flex justify-between px-4 py-2 text-sm">
                    <span>{u.name}</span>
                    <span className="text-ink-3">{u.email}{u.active ? "" : " · desactivado"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nadie de este cliente tiene acceso todavía" />
            )}
          </Section>
          {c.styleProfiles.length > 1 && (
            <Section title="Versiones del perfil">
              <ul className="divide-y divide-line text-sm">
                {c.styleProfiles.map((s) => (
                  <li key={s.id} className="flex justify-between px-4 py-2">
                    <span>v{s.version}</span>
                    <span className="text-ink-3">{fmtDate(s.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
