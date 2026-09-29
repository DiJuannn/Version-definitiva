import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { ProjectForm } from "./project-form";

export const metadata: Metadata = { title: "Nuevo proyecto" };

export default async function NewProjectPage(props: PageProps<"/proyectos/nuevo">) {
  const me = await requireUser(["ADMIN", "COORDINATOR"]);
  const sp = await props.searchParams;
  const [clients, coordinators, teams, packages] = await Promise.all([
    db.client.findMany({ where: { organizationId: me.organizationId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { organizationId: me.organizationId, role: "COORDINATOR", active: true }, select: { id: true, name: true } }),
    db.team.findMany({ where: { organizationId: me.organizationId }, select: { id: true, name: true } }),
    db.servicePackage.findMany({ where: { organizationId: me.organizationId, active: true }, select: { id: true, name: true, clientId: true } }),
  ]);
  return (
    <>
      <PageHeader eyebrow="Proyectos" title="Nuevo proyecto" />
      <ProjectForm
        clients={clients}
        coordinators={coordinators}
        teams={teams}
        packages={packages}
        defaultClientId={typeof sp.cliente === "string" ? sp.cliente : undefined}
        isAdmin={me.role === "ADMIN"}
      />
    </>
  );
}
