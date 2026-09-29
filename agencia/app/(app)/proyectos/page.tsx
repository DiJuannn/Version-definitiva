import type { Metadata } from "next";
import Link from "next/link";
import type { ProjectStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth/current";
import { listProjects } from "@/lib/services/projects";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { PRIORITY, PROJECT_STATUS } from "@/lib/domain/labels";
import { fmtDue } from "@/lib/format";
import { cx } from "@/components/ui/cx";

export const metadata: Metadata = { title: "Proyectos" };

const FILTERS: { key: string; label: string; status?: ProjectStatus }[] = [
  { key: "", label: "En curso", status: "ACTIVE" },
  { key: "solicitados", label: "Solicitados", status: "REQUESTED" },
  { key: "pausa", label: "En pausa", status: "ON_HOLD" },
  { key: "completados", label: "Completados", status: "COMPLETED" },
  { key: "todos", label: "Todos" },
];

export default async function ProjectsPage(props: PageProps<"/proyectos">) {
  const me = await requireUser();
  const sp = await props.searchParams;
  const f = FILTERS.find((x) => x.key === (sp.estado ?? "")) ?? FILTERS[0];
  const q = typeof sp.q === "string" ? sp.q : "";
  const projects = await listProjects(me, { status: f.status, q });
  const manager = me.role === "ADMIN" || me.role === "COORDINATOR";
  return (
    <>
      <PageHeader
        title="Proyectos"
        actions={
          manager ? (
            <ButtonLink href="/proyectos/nuevo" variant="primary">Nuevo proyecto</ButtonLink>
          ) : me.role === "CLIENT" ? (
            <ButtonLink href="/proyectos/solicitar" variant="primary">Solicitar proyecto</ButtonLink>
          ) : null
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-1" aria-label="Filtrar por estado">
          {FILTERS.map((x) => (
            <Link
              key={x.key}
              href={{ pathname: "/proyectos", query: { ...(x.key ? { estado: x.key } : {}), ...(q ? { q } : {}) } }}
              aria-current={x.key === f.key ? "page" : undefined}
              className={cx("rounded-md px-2.5 py-1.5 text-[13px]", x.key === f.key ? "bg-ink text-white" : "text-ink-2 hover:bg-black/5")}
            >
              {x.label}
            </Link>
          ))}
        </nav>
        <form className="w-full sm:w-64" role="search">
          {f.key && <input type="hidden" name="estado" value={f.key} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre"
            aria-label="Buscar proyectos"
            className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm focus:border-focus focus:outline-none"
          />
        </form>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {projects.length ? (
          <table className="w-full text-sm">
            <thead className="hidden border-b border-line bg-surface-2 text-left text-[12px] text-ink-3 md:table-header-group">
              <tr>
                <th className="px-4 py-2 font-medium">Proyecto</th>
                {me.role !== "CLIENT" && <th className="px-4 py-2 font-medium">Cliente</th>}
                <th className="px-4 py-2 font-medium">Piezas</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 text-right font-medium">Entrega</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {projects.map((p) => {
                const done = p.pieces.filter((x) => ["COMPLETED", "FINAL_DELIVERY", "APPROVED"].includes(x.status)).length;
                return (
                  <tr key={p.id} className="relative flex flex-col gap-1 px-4 py-3 hover:bg-surface-2 md:table-row md:p-0">
                    <td className="md:px-4 md:py-3">
                      <Link href={`/proyectos/${p.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                        {p.name}
                      </Link>
                      {(p.priority === "HIGH" || p.priority === "URGENT") && (
                        <Chip tone={PRIORITY[p.priority].tone} dot={false} className="ml-2 h-5 text-[11px]">
                          {PRIORITY[p.priority].label}
                        </Chip>
                      )}
                      {p.coordinator && <p className="text-[13px] text-ink-3">Coordina {p.coordinator.name}</p>}
                    </td>
                    {me.role !== "CLIENT" && <td className="text-ink-2 md:px-4 md:py-3">{p.client.name}</td>}
                    <td className="text-[13px] text-ink-2 tabular md:px-4 md:py-3">
                      {p.pieces.length ? `${done}/${p.pieces.length} aprobadas o entregadas` : "Sin piezas"}
                    </td>
                    <td className="md:px-4 md:py-3">
                      <Chip tone={PROJECT_STATUS[p.status].tone}>{PROJECT_STATUS[p.status].label}</Chip>
                    </td>
                    <td className="text-[13px] text-ink-3 tabular md:px-4 md:py-3 md:text-right">{fmtDue(p.dueDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState title={q ? "Ningún proyecto coincide con la búsqueda" : "No hay proyectos en esta vista"}>
            {manager ? "Crea un proyecto para empezar a organizar piezas, brief y revisiones." : undefined}
          </EmptyState>
        )}
      </div>
    </>
  );
}
