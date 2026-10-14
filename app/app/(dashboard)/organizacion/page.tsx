import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { revokeInvite, updateMemberRole } from "@/lib/actions/team";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { DeleteButton } from "@/components/DeleteButton";
import { SubmitButton } from "@/components/SubmitButton";
import { InviteForm } from "@/components/InviteForm";
import { getCheckoutUrls, buildCheckoutUrl } from "@/lib/lemonsqueezy";
import { isPro } from "@/lib/plan";
import { FREE_FEATURES, PRO_FEATURES } from "@/lib/plan-features";
import { DeleteAccountCard } from "@/components/DeleteAccountCard";
import { PageHeader } from "@/components/PageHeader";

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

  const pro = isPro(profile.organization.plan);
  const prices = checkoutUrls
    ? [
        { id: "monthly", price: "6,99 €", per: "al mes", note: "Cancela cuando quieras", url: checkoutUrls.monthly, featured: false },
        { id: "yearly", price: "69,99 €", per: "al año", note: "2 meses gratis", url: checkoutUrls.yearly, featured: true },
        ...(checkoutUrls.lifetime
          ? [{ id: "lifetime", price: "120 €", per: "pago único", note: "Para siempre, sin renovaciones", url: checkoutUrls.lifetime, featured: false }]
          : []),
      ]
    : [];
  const H2 = "font-display text-2xl font-black tracking-tight uppercase";

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Organización"
        title={profile.organization.name}
        description="Tu plan, quién entra al Taller y qué puede hacer cada persona."
        actions={
          <nav aria-label="Secciones" className="flex gap-6 font-mono text-[11px] tracking-widest uppercase">
            <a href="#plan" className="text-muted hover:text-fg">
              Plan
            </a>
            <a href="#personas" className="text-muted hover:text-fg">
              Personas
            </a>
            <a href="#cuenta" className="text-muted hover:text-fg">
              Tu cuenta
            </a>
          </nav>
        }
      />

      {/* ------------------------------------------------ plan */}
      <section id="plan" aria-labelledby="plan-title" className="mt-14 scroll-mt-32">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-3">
          <h2 id="plan-title" className={H2}>
            Plan
          </h2>
          <span
            className={`rounded-full px-3 py-1 font-mono text-[10px] tracking-widest uppercase ${
              pro ? "bg-accent text-bg" : "bg-fg/[0.07] text-muted"
            }`}
          >
            {pro ? "PRO" : "Gratis"}
          </span>
        </div>

        {pro ? (
          <div className="mt-6 grid gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <p className="max-w-sm font-sans text-[15px] leading-relaxed">
              Tu organización tiene <strong>PRO</strong>: todas las herramientas, sin límites, para todo el equipo.
            </p>
            <ul className="gap-x-10 font-sans text-sm sm:columns-2">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="mb-2.5 flex break-inside-avoid gap-2">
                  <span aria-hidden className="text-accent">
                    ✓
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-x-12 gap-y-8 sm:grid-cols-2">
              <div>
                <p className="eyebrow">Ahora · Gratis</p>
                <ul className="mt-3 space-y-2 font-sans text-sm text-muted">
                  {FREE_FEATURES.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span aria-hidden>·</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="eyebrow text-accent">Con PRO</p>
                <ul className="mt-3 space-y-2 font-sans text-sm">
                  {PRO_FEATURES.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span aria-hidden className="text-accent">
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {prices.length > 0 ? (
              <div className={`mt-10 grid border-y border-line sm:divide-x sm:divide-line ${prices.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                {prices.map((option) => (
                  <div key={option.id} className="border-b border-line py-6 last:border-b-0 sm:border-b-0 sm:px-6 sm:first:pl-0">
                    <p className="font-display text-3xl font-black tabular-nums">
                      {option.price}{" "}
                      <span className="font-sans text-sm font-normal text-muted">{option.per}</span>
                    </p>
                    <p className={`mt-1 font-mono text-[11px] tracking-widest uppercase ${option.featured ? "text-accent" : "text-muted"}`}>
                      {option.note}
                    </p>
                    <a
                      href={buildCheckoutUrl(option.url, profile.organizationId, profile.email)}
                      className={`btn mt-5 ${option.featured ? "btn-primary" : "btn-outline"}`}
                    >
                      Pasarme a PRO
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-8 border-l-2 border-line pl-3 font-sans text-sm text-muted">
                El cobro todavía se está configurando. Vuelve pronto.
              </p>
            )}
          </>
        )}
      </section>

      {/* ------------------------------------------------ personas */}
      <section id="personas" aria-labelledby="personas-title" className="mt-20 scroll-mt-32">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-3">
          <h2 id="personas-title" className={H2}>
            Personas con acceso
          </h2>
          <span className="font-mono text-[11px] tracking-widest text-muted uppercase">
            {members.length} {members.length === 1 ? "persona" : "personas"}
          </span>
        </div>
        <dl className="mt-4 grid gap-x-10 gap-y-1 font-sans text-sm text-muted sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="font-medium text-fg">Admin</dt>
            <dd>entra a todo: el Taller, la web pública y esta página.</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-fg">Miembro</dt>
            <dd>trabaja en el Taller, sin tocar la web ni el plan.</dd>
          </div>
        </dl>

        <ul className="mt-6 divide-y divide-line border-y border-line">
          {members.map((member) => {
            const name = member.fullName || member.email;
            const locked = member.id === profile.id && adminCount === 1;
            return (
              <li key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5">
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fg/[0.07] font-display text-sm font-black text-muted uppercase"
                >
                  {name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-sans text-[15px] font-medium">
                    {name}
                    {member.id === profile.id && <span className="ml-2 font-sans text-[13px] font-normal text-muted">(tú)</span>}
                  </span>
                  {member.fullName && <span className="block truncate font-sans text-[13px] text-muted">{member.email}</span>}
                </span>
                <form action={updateMemberRole.bind(null, member.id)} className="flex items-center gap-3">
                  <label>
                    <span className="sr-only">Rol de {name}</span>
                    <select
                      name="role"
                      defaultValue={member.role}
                      disabled={locked}
                      title={locked ? "Eres el único admin: nombra a otra persona admin antes de cambiar tu rol." : undefined}
                      className="field-line mt-0 w-32 disabled:opacity-50"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="MEMBER">Miembro</option>
                    </select>
                  </label>
                  {!locked && (
                    <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="link-action">
                      Guardar
                    </SubmitButton>
                  )}
                </form>
              </li>
            );
          })}
        </ul>

        <div className="mt-10 grid gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h3 className="font-display text-lg font-bold">Invitar a alguien</h3>
            <p className="mt-1 max-w-md font-sans text-sm leading-relaxed text-muted">
              Se crea un enlace de un solo uso. Cópialo y mándaselo tú (WhatsApp, email…): no se envía nada
              automáticamente.
            </p>
            <InviteForm />
          </div>

          <div>
            <h3 className="eyebrow border-b border-line pb-2">
              Pendientes de aceptar{invites.length > 0 ? ` · ${invites.length}` : ""}
            </h3>
            {invites.length === 0 ? (
              <p className="py-3 font-sans text-sm text-muted">No hay invitaciones pendientes.</p>
            ) : (
              <ul className="divide-y divide-line">
                {invites.map((invite) => (
                  <li key={invite.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-sans text-[15px]">{invite.email}</span>
                      <span className="block font-sans text-[13px] text-muted">
                        Como {ROLE_LABELS[invite.role].toLowerCase()} · aún no ha entrado
                      </span>
                    </span>
                    <span className="flex items-center gap-4">
                      <CopyLinkButton link={`${origin}/app/signup?invite=${invite.token}`} />
                      <form action={revokeInvite.bind(null, invite.id)}>
                        <DeleteButton
                          confirmMessage="¿Revocar esta invitación? El enlace dejará de funcionar."
                          className="link-action"
                        >
                          Revocar
                        </DeleteButton>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ cuenta */}
      <section id="cuenta" aria-labelledby="cuenta-title" className="mt-20 scroll-mt-32">
        <h2 id="cuenta-title" className={`${H2} border-b border-line pb-3`}>
          Tu cuenta
        </h2>
        <DeleteAccountCard soleMember={members.length === 1} />
      </section>
    </div>
  );
}
