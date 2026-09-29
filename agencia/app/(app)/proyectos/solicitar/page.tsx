import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "Solicitar proyecto" };

export default async function RequestPage() {
  const me = await requireUser(["CLIENT"]);
  const org = await db.organization.findUniqueOrThrow({ where: { id: me.organizationId } });
  if (!org.clientRequests) notFound();
  return (
    <>
      <PageHeader eyebrow="Proyectos" title="Solicitar un proyecto" meta={<span>Cuéntanos lo básico. Después completarás un brief guiado.</span>} />
      <RequestForm />
    </>
  );
}
