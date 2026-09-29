import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { listClients } from "@/lib/services/clients";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage() {
  const me = await requireUser(["ADMIN", "COORDINATOR"]);
  const clients = await listClients(me);
  return (
    <>
      <PageHeader title="Clientes" actions={me.role === "ADMIN" && <ButtonLink href="/clientes/nuevo" variant="primary">Nuevo cliente</ButtonLink>} />
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {clients.length ? (
          <ul className="divide-y divide-line">
            {clients.map((c) => (
              <li key={c.id} className="relative flex items-center gap-4 px-4 py-3 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <Link href={`/clientes/${c.id}`} className="font-medium after:absolute after:inset-0 hover:underline">{c.name}</Link>
                  <p className="text-[13px] text-ink-3">{[c.contactName, c.contactEmail].filter(Boolean).join(" · ") || "Sin contacto"}</p>
                </div>
                <span className="text-[13px] text-ink-3 tabular">{c._count.projects} proyectos · {c._count.users} accesos</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Aún no hay clientes" />
        )}
      </div>
    </>
  );
}
