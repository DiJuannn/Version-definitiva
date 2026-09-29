import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { financePermAction, processOutboxAction, setUserActiveAction } from "@/app/actions/admin";
import { buttonClass } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Notice, PageHeader, Section } from "@/components/ui/misc";
import { ROLE_LABEL } from "@/lib/domain/labels";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { OrgForm, ResetPasswordForm, UserForm } from "./forms";

export const metadata: Metadata = { title: "Ajustes" };

const OUTBOX = { PENDING: "Pendiente", SENT: "Enviado", FAILED: "Fallido", SKIPPED: "Omitido" } as const;

export default async function SettingsPage() {
  const me = await requireUser(["ADMIN"]);
  const [org, users, clients, outbox] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: me.organizationId } }),
    db.user.findMany({ where: { organizationId: me.organizationId }, orderBy: [{ role: "asc" }, { name: "asc" }], include: { client: { select: { name: true } } } }),
    db.client.findMany({ where: { organizationId: me.organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.emailOutbox.findMany({ where: { organizationId: me.organizationId }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  const e = env();
  const emailConfigured = !!(e.RESEND_API_KEY && e.EMAIL_FROM);
  const aiConfigured = e.AI_PROVIDER !== "none" && !!e.ANTHROPIC_API_KEY;
  return (
    <>
      <PageHeader title="Ajustes y usuarios" />
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-5">
          <Section title="Usuarios" description="Desactivar a alguien cierra sus sesiones al instante.">
            <ul className="divide-y divide-line">
              {users.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className={u.active ? "font-medium" : "font-medium text-ink-3 line-through"}>{u.name}</p>
                    <p className="text-[12px] text-ink-3">
                      {u.email} · {ROLE_LABEL[u.role]}
                      {u.client ? ` · ${u.client.name}` : ""}
                      {u.lastLoginAt ? ` · entró ${fmtRelative(u.lastLoginAt)}` : " · nunca ha entrado"}
                    </p>
                  </div>
                  {u.role === "COORDINATOR" && (
                    <form action={financePermAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="value" value={u.canViewFinance ? "false" : "true"} />
                      <button className="text-[12px] text-ink-2 hover:text-ink" title="Permiso para ver información económica de sus proyectos">
                        {u.canViewFinance ? "Quitar finanzas" : "Dar acceso a finanzas"}
                      </button>
                    </form>
                  )}
                  <ResetPasswordForm userId={u.id} />
                  {u.id !== me.id && (
                    <form action={setUserActiveAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="active" value={u.active ? "false" : "true"} />
                      <button className={buttonClass("ghost", "sm")}>{u.active ? "Desactivar" : "Reactivar"}</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Nuevo usuario" description="Crea la cuenta y comparte la contraseña inicial por un canal seguro. La persona puede cambiarla en «Tu cuenta».">
            <UserForm clients={clients} />
          </Section>
        </div>
        <div className="flex flex-col gap-5">
          <Section title="Organización">
            <OrgForm org={{ name: org.name, currency: org.currency, taxPct: (org.defaultTaxBps / 100).toString(), approvalPolicy: org.approvalPolicy, clientRequests: org.clientRequests, aiEnabled: org.aiEnabled }} aiConfigured={aiConfigured} />
          </Section>
          <Section
            title="Correo saliente"
            description={emailConfigured ? "Proveedor: Resend." : "Sin proveedor configurado: los emails quedan como «omitidos». Los avisos dentro de la app funcionan igual."}
            actions={
              <form action={processOutboxAction}>
                <button className={buttonClass("secondary", "sm")}>Procesar ahora</button>
              </form>
            }
          >
            {!emailConfigured && (
              <div className="px-4 pt-3">
                <Notice tone="attention">Para enviar emails reales hace falta RESEND_API_KEY y EMAIL_FROM con un dominio verificado.</Notice>
              </div>
            )}
            <ul className="divide-y divide-line">
              {outbox.map((o) => (
                <li key={o.id} className="px-4 py-2 text-[13px]">
                  <div className="flex items-center gap-2">
                    <Chip tone={o.status === "SENT" ? "success" : o.status === "FAILED" ? "danger" : o.status === "SKIPPED" ? "muted" : "attention"}>{OUTBOX[o.status]}</Chip>
                    <span className="truncate">{o.subject}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-ink-3">
                    {o.to} · {fmtDateTime(o.createdAt)} · {o.attempts} intentos{o.lastError ? ` · ${o.lastError}` : ""}
                  </p>
                </li>
              ))}
              {!outbox.length && <li className="px-4 py-3 text-[13px] text-ink-3">Nada en la bandeja.</li>}
            </ul>
          </Section>
        </div>
      </div>
    </>
  );
}
