import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { revokeInvite, updateMemberRole } from "@/lib/actions/team";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { DeleteButton } from "@/components/DeleteButton";
import { HelpTip } from "@/components/HelpTip";
import { FeatureIntro } from "@/components/FeatureIntro";
import { SubmitButton } from "@/components/SubmitButton";
import { InviteForm } from "@/components/InviteForm";
import { getCheckoutUrls, buildCheckoutUrl } from "@/lib/lemonsqueezy";
import {
  FREE_ACTIVE_PROJECTS_LIMIT,
  FREE_PROJECT_COLLABORATORS_LIMIT,
  SCRIPT_ANALYSIS_FREE_DAILY_LIMIT,
  SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT,
  SCRIPT_ANALYSIS_PRO_DAILY_LIMIT,
  SCRIPT_PAGE_LIMIT_FREE,
  SCRIPT_PAGE_LIMIT_PRO,
} from "@/lib/limits";

const FREE_FEATURES = [
  `Hasta ${FREE_ACTIVE_PROJECTS_LIMIT} proyectos activos`,
  `Hasta ${FREE_PROJECT_COLLABORATORS_LIMIT} colaboradores por proyecto`,
  `Guiones de hasta ${SCRIPT_PAGE_LIMIT_FREE} páginas`,
  `${SCRIPT_ANALYSIS_FREE_DAILY_LIMIT} análisis de IA al día, ${SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT} en total`,
];

const PRO_FEATURES = [
  "Proyectos y colaboradores ilimitados",
  `Guiones de hasta ${SCRIPT_PAGE_LIMIT_PRO} páginas`,
  `Hasta ${SCRIPT_ANALYSIS_PRO_DAILY_LIMIT} análisis de IA al día`,
  "Dossier completo del proyecto en PDF",
  "Detector de continuidad con IA",
  "Plantilla de documentos lista para firmar (permiso de rodaje, cesión de imagen, contrato de colaboración, autorización de menor, NDA)",
];

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
  const checkoutUrls = getCheckoutUrls();

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
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Plan
          </p>
          <span
            className={`rounded-full px-3 py-1 font-mono text-[10px] tracking-widest uppercase ${
              profile.organization.plan === "PRO"
                ? "bg-accent text-bg"
                : "border border-line text-muted"
            }`}
          >
            {profile.organization.plan === "PRO" ? "PRO" : "Gratis"}
          </span>
        </div>

        {profile.organization.plan === "PRO" ? (
          <ul className="mt-4 space-y-1.5 font-mono text-xs text-muted">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex gap-2">
                <span className="text-accent">✓</span>
                {feature}
              </li>
            ))}
          </ul>
        ) : (
          <>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                  Tu plan — Gratis
                </p>
                <ul className="mt-2 space-y-1.5 font-mono text-xs text-muted">
                  {FREE_FEATURES.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span>·</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
                  Con PRO
                </p>
                <ul className="mt-2 space-y-1.5 font-mono text-xs text-muted">
                  {PRO_FEATURES.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span className="text-accent">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {checkoutUrls ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="border border-line p-4">
                  <p className="font-display text-2xl font-bold">
                    6,99€
                    <span className="font-mono text-xs font-normal text-muted">
                      /mes
                    </span>
                  </p>
                  <a
                    href={buildCheckoutUrl(
                      checkoutUrls.monthly,
                      profile.organizationId,
                      profile.email,
                    )}
                    className="mt-4 inline-block rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
                  >
                    Pasarme a PRO
                  </a>
                </div>
                <div className="border border-accent p-4">
                  <p className="font-display text-2xl font-bold">
                    69,99€
                    <span className="font-mono text-xs font-normal text-muted">
                      /año
                    </span>
                  </p>
                  <p className="mt-1 font-mono text-[10px] tracking-widest text-accent uppercase">
                    2 meses gratis
                  </p>
                  <a
                    href={buildCheckoutUrl(
                      checkoutUrls.yearly,
                      profile.organizationId,
                      profile.email,
                    )}
                    className="mt-3 inline-block rounded-full bg-accent px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
                  >
                    Pasarme a PRO
                  </a>
                </div>
              </div>
            ) : (
              <p className="mt-4 font-mono text-xs text-muted">
                El cobro todavía se está configurando — vuelve pronto.
              </p>
            )}
          </>
        )}
      </section>

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
                <SubmitButton
                  pendingLabel="Guardando…"
                  savedLabel="✓ Guardado"
                  className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                >
                  Guardar
                </SubmitButton>
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
        <InviteForm />

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
                    <DeleteButton
                      confirmMessage="¿Revocar esta invitación? El enlace dejará de funcionar."
                      className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                    >
                      Revocar
                    </DeleteButton>
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
