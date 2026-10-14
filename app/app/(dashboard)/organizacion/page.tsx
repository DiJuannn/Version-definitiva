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
  const H2 = "font-display text-xl font-black tracking-tight uppercase";
  const admins = members.filter((m) => m.role === "ADMIN").length;
  const memberCount = members.length - admins;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Organización"
        title={profile.organization.name}
        description="Tu plan, quién entra al Taller y qué puede hacer cada persona."
        actions={
          <a href="#invitar" className="btn btn-primary">
            <span aria-hidden className="text-sm leading-none">+</span>
            Invitar a alguien
          </a>
        }
      />

      {/* Cómo voy */}
      <div className="mt-8 space-y-2 font-sans text-[15px] leading-relaxed text-muted">
        <p>
          Plan <span className={pro ? "font-medium text-accent" : "text-fg"}>{pro ? "PRO" : "Gratis"}</span> ·{" "}
          <span className="text-fg">
            {members.length} {members.length === 1 ? "persona" : "personas"} con acceso
          </span>{" "}
          ({admins} {admins === 1 ? "admin" : "admins"}, {memberCount} {memberCount === 1 ? "miembro" : "miembros"})
          {invites.length > 0 &&
            ` · ${invites.length} ${invites.length === 1 ? "invitación sin aceptar" : "invitaciones sin aceptar"}`}
          .
        </p>
        {invites.length > 0 && (
          <p className="border-l-2 border-warn pl-3 text-sm">
            {invites.map((i) => i.email).join(", ")} {invites.length === 1 ? "aún no ha entrado" : "aún no han entrado"}:
            copia su enlace de nuevo y reenvíaselo si hace falta.
          </p>
        )}
      </div>

      {/* ------------------------------------------------ personas */}
      <section id="personas" aria-labelledby="personas-title" className="mt-12 scroll-mt-32">
        <h2 id="personas-title" className={H2}>
          Quién entra
        </h2>
        <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-1 font-sans text-sm text-muted">
          <div className="flex gap-2">
            <dt className="font-medium text-fg">Admin</dt>
            <dd>entra a todo: el Taller, la web pública y esta página.</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-fg">Miembro</dt>
            <dd>trabaja en el Taller, sin tocar la web ni el plan.</dd>
          </div>
        </dl>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <ul className="sheet divide-y divide-line">
            {members.map((member) => {
              const name = member.fullName || member.email;
              const locked = member.id === profile.id && adminCount === 1;
              const isAdmin = member.role === "ADMIN";
              return (
                <li key={member.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
                  <span
                    aria-hidden
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-sm font-black uppercase ${
                      isAdmin ? "bg-accent/20 text-accent" : "bg-fg/[0.07] text-muted"
                    }`}
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
                        className="field w-32 py-1.5 disabled:opacity-50"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MEMBER">Miembro</option>
                      </select>
                    </label>
                    {!locked ? (
                      <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="link-action">
                        Guardar
                      </SubmitButton>
                    ) : (
                      <span className="w-14 font-sans text-[11px] leading-tight text-muted">único admin</span>
                    )}
                  </form>
                </li>
              );
            })}
            {invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-dashed border-warn/70 font-mono text-[13px] text-warn"
                >
                  ?
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-sans text-[15px]">{invite.email}</span>
                  <span className="block font-sans text-[13px] text-warn">
                    Invitación pendiente · entrará como {ROLE_LABELS[invite.role].toLowerCase()}
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

          {/* Invitar: es un formulario, así que va en papel. */}
          <div id="invitar" className="paper scroll-mt-32 p-5 sm:p-6">
            <h3 className="font-display text-lg font-bold">Invitar a alguien</h3>
            <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
              Se crea un enlace de un solo uso. Cópialo y mándaselo tú (WhatsApp, email…): no se envía nada
              automáticamente.
            </p>
            <InviteForm />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ plan */}
      <section id="plan" aria-labelledby="plan-title" className="mt-16 scroll-mt-32">
        <div className="flex flex-wrap items-center gap-3">
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
          <div className="tile mt-4 grid gap-x-12 gap-y-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <p className="max-w-sm font-sans text-[15px] leading-relaxed">
              Tu organización tiene <strong>PRO</strong>: todas las herramientas, sin límites, para todo el equipo.
            </p>
            <ul className="gap-x-10 font-sans text-sm text-muted sm:columns-2">
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
              <div className={`mt-10 grid gap-3 ${prices.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                {prices.map((option) => (
                  <div
                    key={option.id}
                    className={`tile p-5 ${option.featured ? "shadow-[0_0_0_1.5px_var(--accent)]" : ""}`}
                  >
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

      {/* ------------------------------------------------ zona peligrosa */}
      <section id="cuenta" aria-labelledby="cuenta-title" className="mt-24 scroll-mt-32 border-t border-danger/40 pt-6">
        <h2 id="cuenta-title" className="eyebrow !text-danger">
          Zona peligrosa
        </h2>
        <DeleteAccountCard soleMember={members.length === 1} />
      </section>
    </div>
  );
}
