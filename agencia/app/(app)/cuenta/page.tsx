import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { revokeSessionAction } from "@/app/actions/admin";
import { buttonClass } from "@/components/ui/button";
import { PageHeader, Section } from "@/components/ui/misc";
import { ROLE_LABEL } from "@/lib/domain/labels";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
import { fmtDateTime } from "@/lib/format";
import { AvailabilityForm, PasswordForm, PrefsForm } from "./forms";

export const metadata: Metadata = { title: "Tu cuenta" };

export default async function AccountPage() {
  const me = await requireUser();
  const [sessions, prefs, profile] = await Promise.all([
    db.session.findMany({ where: { userId: me.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } }),
    db.notificationPreference.findMany({ where: { userId: me.id } }),
    me.role === "EDITOR" ? db.editorProfile.findUnique({ where: { userId: me.id } }) : null,
  ]);
  const types = Object.entries(NOTIFICATION_TYPES).filter(([k]) => (me.role === "CLIENT" ? ["VERSION_PUBLISHED", "REPLY", "MENTION", "CORRECTION_RESOLVED", "DELIVERY"].includes(k) : true));
  return (
    <>
      <PageHeader title="Tu cuenta" meta={<span>{me.email} · {ROLE_LABEL[me.role]}</span>} />
      <div className="grid gap-5 lg:grid-cols-2">
        {profile && (
          <Section title="Tu disponibilidad" description="Coordinación la ve al asignar trabajo.">
            <AvailabilityForm userId={me.id} availability={profile.availability} note={profile.availabilityNote ?? ""} capacity={profile.capacity} />
          </Section>
        )}
        <Section title="Contraseña">
          <PasswordForm />
        </Section>
        <Section title="Sesiones abiertas" description="Cierra las que no reconozcas.">
          <ul className="divide-y divide-line">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{s.userAgent?.slice(0, 80) ?? "Navegador desconocido"}</p>
                  <p className="text-[12px] text-ink-3">
                    {s.id === me.sessionId ? "Esta sesión · " : ""}Última actividad {fmtDateTime(s.lastSeenAt)}
                    {s.ip ? ` · ${s.ip}` : ""}
                  </p>
                </div>
                {s.id !== me.sessionId && (
                  <form action={revokeSessionAction}>
                    <input type="hidden" name="sessionId" value={s.id} />
                    <button className={buttonClass("ghost", "sm")}>Cerrar</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Avisos" description="Elige qué quieres recibir y por dónde.">
          <PrefsForm types={types} prefs={prefs.map((p) => ({ type: p.type, inApp: p.inApp, email: p.email }))} />
        </Section>
      </div>
    </>
  );
}
