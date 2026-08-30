import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { createInvite, revokeInvite, updateMemberRole } from "@/lib/actions/team";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { HelpTip } from "@/components/HelpTip";
import { FeatureIntro } from "@/components/FeatureIntro";

const ROLE_LABELS = { ADMIN: "Admin", MEMBER: "Miembro" } as const;

export default async function OrganizacionPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/app/login");
  if (profile.role !== "ADMIN") redirect("/app");

  const [members, invites, origin] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: profile.organizationId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invite.findMany({
      where: { organizationId: profile.organizationId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    headers().then((h) => h.get("origin") ?? ""),
  ]);

  const adminCount = members.filter((m) => m.role === "ADMIN").length;

  return (
    <div>
      <p className="font-mono text-xs tracking-widest text-accent uppercase">
        Organización
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold uppercase">
        Equipo y accesos
      </h1>

      <FeatureIntro featureId="organizacion">
        Aquí invitas a tus compañeros al Taller y decides qué puede hacer
        cada uno. <strong>Admin</strong> tiene acceso a todo, incluida la web
        pública. <strong>Miembro</strong> solo entra al Taller, sin poder
        tocar la web.
      </FeatureIntro>

      <section className="mt-10 border border-line p-6">
        <p className="font-mono text-xs tracking-widest text-accent uppercase">
          Miembros
        </p>
        <div className="mt-4 divide-y divide-line">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-mono text-sm">
                  {member.fullName || member.email}
                </p>
                {member.fullName && (
                  <p className="font-mono text-xs text-muted">{member.email}</p>
                )}
              </div>
              <form
                action={updateMemberRole.bind(null, member.id)}
                className="flex items-center gap-2"
              >
                <select
                  name="role"
                  defaultValue={member.role}
                  disabled={member.id === profile.id && adminCount === 1}
                  className="border border-line bg-transparent px-2 py-1 font-mono text-xs uppercase outline-none focus:border-accent disabled:opacity-40"
                >
                  <option value="ADMIN" className="bg-bg">Admin</option>
                  <option value="MEMBER" className="bg-bg">Miembro</option>
                </select>
                <button
                  type="submit"
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                >
                  Guardar
                </button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 border border-line p-6">
        <div className="flex items-center gap-1.5">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Invitar a alguien
          </p>
          <HelpTip text="Se genera un enlace único de un solo uso. Cópialo y mándaselo tú mismo (WhatsApp, email...) — no se envía nada automáticamente." />
        </div>
        <form
          action={createInvite}
          className="mt-4 flex flex-wrap gap-3"
        >
          <input
            name="email"
            type="email"
            placeholder="email@ejemplo.com"
            required
            className="min-w-[220px] flex-1 border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <select
            name="role"
            defaultValue="MEMBER"
            className="border border-line bg-transparent px-3 py-2 font-mono text-xs uppercase outline-none focus:border-accent"
          >
            <option value="MEMBER" className="bg-bg">Miembro</option>
            <option value="ADMIN" className="bg-bg">Admin</option>
          </select>
          <button
            type="submit"
            className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Invitar
          </button>
        </form>

        {invites.length > 0 && (
          <div className="mt-6 divide-y divide-line border-t border-line">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-mono text-sm">{invite.email}</p>
                  <p className="font-mono text-xs text-muted">
                    {ROLE_LABELS[invite.role]} · pendiente de aceptar
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <CopyLinkButton
                    link={`${origin}/app/signup?invite=${invite.token}`}
                  />
                  <form action={revokeInvite.bind(null, invite.id)}>
                    <button
                      type="submit"
                      className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                    >
                      Revocar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
