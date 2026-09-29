import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current";
import { PageHeader } from "@/components/ui/misc";
import { ClientForm } from "./client-form";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default async function NewClientPage() {
  await requireUser(["ADMIN"]);
  return (
    <>
      <PageHeader eyebrow="Clientes" title="Nuevo cliente" />
      <ClientForm />
    </>
  );
}
