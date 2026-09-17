import { prisma } from "@/lib/prisma";
import { Reveal } from "@/components/Reveal";

export const metadata = {
  title: "Equipo",
};

// Ejemplo de partida — se muestra solo si nadie ha cargado equipamiento real
// todavía desde /admin, para que la sección no quede vacía mientras tanto.
const DEFAULT_EQUIPMENT = [
  { category: "Cámara", detail: "Por confirmar — añade la vuestra desde /admin." },
  { category: "Ópticas", detail: "Por confirmar — añade las vuestras desde /admin." },
  { category: "Iluminación", detail: "Por confirmar — añade la vuestra desde /admin." },
  { category: "Flujo de trabajo", detail: "Por confirmar — formatos y códecs de entrega." },
];

export default async function EquipoPage() {
  const site = await prisma.siteContent.findFirst({
    where: { organization: { isPlatformOwner: true } },
    include: {
      teamMembers: { orderBy: { order: "asc" } },
      equipmentItems: { orderBy: { order: "asc" } },
    },
  });
  const teamMembers = site?.teamMembers ?? [];
  const equipmentItems =
    site && site.equipmentItems.length > 0 ? site.equipmentItems : DEFAULT_EQUIPMENT;

  return (
    <section className="px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <span className="font-mono text-xs tracking-widest text-accent uppercase">
            Equipo
          </span>
          <h1 className="mt-4 font-display text-4xl leading-tight font-black uppercase sm:text-6xl">
            Quién hay detrás.
          </h1>
        </Reveal>

        {teamMembers.length === 0 ? (
          <Reveal delay={0.1}>
            <p className="mt-12 font-mono text-sm text-muted">
              Aún no hemos publicado aquí al equipo.
            </p>
          </Reveal>
        ) : (
          <div className="mt-16 divide-y divide-line border-t border-line">
            {teamMembers.map((member, i) => (
              <Reveal key={member.id} delay={i * 0.08}>
                <div className="grid gap-6 py-12 sm:grid-cols-[14rem_1fr] sm:gap-12">
                  {member.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.photoUrl}
                      alt={member.name}
                      className="aspect-[4/5] w-full max-w-56 rounded-sm border border-line object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/5] w-full max-w-56 items-center justify-center rounded-sm border border-line bg-bg-raised font-display text-6xl font-black text-accent">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col justify-center">
                    <span className="font-mono text-xs tracking-widest text-accent uppercase">
                      {member.role}
                    </span>
                    <h2 className="mt-2 font-display text-3xl font-bold uppercase sm:text-4xl">
                      {member.name}
                    </h2>
                    {member.bio && (
                      <p className="mt-4 max-w-xl font-mono text-sm leading-relaxed text-muted">
                        {member.bio}
                      </p>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}

        <div className="mt-24 border-t border-line pt-16">
          <Reveal>
            <span className="font-mono text-xs tracking-widest text-accent uppercase">
              Equipamiento
            </span>
          </Reveal>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {equipmentItems.map((item, i) => (
              <Reveal key={item.category} delay={i * 0.06}>
                <div className="border-t border-accent pt-3">
                  <h3 className="font-mono text-xs tracking-widest text-muted uppercase">
                    {item.category}
                  </h3>
                  <p className="mt-2 font-display text-sm font-bold uppercase">
                    {item.detail}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
