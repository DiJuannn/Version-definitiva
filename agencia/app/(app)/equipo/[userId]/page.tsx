import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { Chip } from "@/components/ui/chip";
import { DefinitionList, EmptyState, PageHeader, Section } from "@/components/ui/misc";
import { PieceList, PieceRow } from "@/components/work/piece-row";
import { AVAILABILITY } from "@/lib/domain/labels";
import { LOAD_PIECE_STATUSES } from "@/lib/domain/piece-status";
import { formatMoney } from "@/lib/domain/money";
import { EditorProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Editor" };

export default async function EditorPage(props: PageProps<"/equipo/[userId]">) {
  const me = await requireUser(["ADMIN", "COORDINATOR"]);
  const { userId } = await props.params;
  const u = await db.user.findFirst({ where: { id: userId, organizationId: me.organizationId, role: "EDITOR" }, include: { editorProfile: true } });
  if (!u) notFound();
  const [active, done] = await Promise.all([
    db.piece.findMany({
      where: { editorId: u.id, status: { in: LOAD_PIECE_STATUSES } },
      select: { id: true, title: true, status: true, dueDate: true, priority: true, project: { select: { id: true, name: true, client: { select: { name: true } } } } },
      orderBy: { dueDate: "asc" },
    }),
    db.piece.findMany({
      where: { editorId: u.id, status: { in: ["APPROVED", "FINAL_DELIVERY", "COMPLETED"] } },
      select: { id: true, dueDate: true, updatedAt: true, project: { select: { client: { select: { name: true } } } }, _count: { select: { versions: true } } },
    }),
  ]);
  const byClient = new Map<string, number>();
  for (const p of done) byClient.set(p.project.client.name, (byClient.get(p.project.client.name) ?? 0) + 1);
  const avgVersions = done.length ? (done.reduce((a, p) => a + p._count.versions, 0) / done.length).toFixed(1) : null;
  const pr = u.editorProfile;
  const av = AVAILABILITY[pr?.availability ?? "AVAILABLE"];
  return (
    <>
      <PageHeader eyebrow={<Link href="/equipo" className="hover:text-ink">Equipo</Link>} title={u.name} meta={<><Chip tone={av.tone}>{av.label}</Chip><span className="text-ink-3">{u.email}</span></>} />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          <Section title="Piezas activas">
            {active.length ? <PieceList>{active.map((p) => <PieceRow key={p.id} p={p} />)}</PieceList> : <EmptyState title="Sin piezas activas" />}
          </Section>
          <Section title="Historial con clientes" description="Piezas aprobadas o entregadas.">
            {byClient.size ? (
              <ul className="divide-y divide-line">
                {[...byClient.entries()].map(([name, n]) => (
                  <li key={name} className="flex justify-between px-4 py-2 text-sm">
                    <span>{name}</span>
                    <span className="text-ink-3 tabular">{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Aún sin piezas terminadas" />
            )}
          </Section>
          <Section title="Métricas operativas" description="Con contexto: dependen del tipo de pieza, del cliente y de cuántas rondas pidió. No son una valoración personal.">
            <div className="px-4 py-3">
              <DefinitionList
                items={[
                  { term: "Terminadas", value: done.length },
                  { term: "Versiones por pieza", value: avgVersions ?? "—" },
                  { term: "Carga actual", value: `${active.length} de ${pr?.capacity ?? 3}` },
                ]}
              />
            </div>
          </Section>
        </div>
        <Section title="Perfil" description={me.role === "ADMIN" ? "La tarifa y las notas internas solo las ve administración." : undefined}>
          {me.role === "ADMIN" && pr?.rateCents != null && (
            <p className="px-4 pt-3 text-[13px] text-ink-3">Tarifa actual: {formatMoney(pr.rateCents, pr.rateCurrency)} por pieza</p>
          )}
          <EditorProfileForm
            userId={u.id}
            isAdmin={me.role === "ADMIN"}
            profile={{
              specialties: pr?.specialties.join(", ") ?? "",
              software: pr?.software.join(", ") ?? "",
              availability: pr?.availability ?? "AVAILABLE",
              availabilityNote: pr?.availabilityNote ?? "",
              capacity: pr?.capacity ?? 3,
              rate: pr?.rateCents != null ? (pr.rateCents / 100).toFixed(2).replace(".", ",") : "",
              internalNotes: pr?.internalNotes ?? "",
            }}
          />
        </Section>
      </div>
    </>
  );
}
