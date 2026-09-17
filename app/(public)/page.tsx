import { prisma } from "@/lib/prisma";
import { HeroReveal } from "@/components/HeroReveal";
import { PlaceholderFrame } from "@/components/PlaceholderFrame";
import { Reveal } from "@/components/Reveal";
import { PortfolioSection } from "@/components/PortfolioSection";
import { BudgetRequestForm } from "@/components/BudgetRequestForm";

const DEFAULT_TAGS = [
  "FICCIÓN",
  "PUBLICIDAD",
  "DOCUMENTAL",
  "CORPORATIVO",
  "COLOR",
  "SONIDO",
  "MONTAJE",
];

const DEFAULT_SERVICIOS = [
  {
    num: "01",
    title: "Ficción",
    description: "Cortometrajes y largometrajes, del guion al montaje final.",
    details:
      "Desarrollo de guion, dirección, producción y montaje. Trabajamos con equipos reducidos y flexibles, adaptando el rodaje al presupuesto real del proyecto sin renunciar a la calidad de imagen y sonido.",
  },
  {
    num: "02",
    title: "Publicidad",
    description: "Spots y branded content con mirada cinematográfica.",
    details:
      "Spots, branded content y vídeo para redes. Del concepto al entregado final, con formatos pensados para cada plataforma (TV, YouTube, Instagram, TikTok) desde la misma grabación.",
  },
  {
    num: "03",
    title: "Documental",
    description: "Historias reales, contadas con tiempo y cuidado.",
    details:
      "Documental de autor y documental corporativo. Investigación, rodaje con disponibilidad para adaptarse a los tiempos reales de la historia, y montaje narrativo cuidado.",
  },
  {
    num: "04",
    title: "Corporativo",
    description: "Vídeo institucional, eventos y contenido de marca.",
    details:
      "Vídeo institucional, cobertura de eventos y contenido de marca para uso interno o comercial. Entrega rápida y formatos listos para web, redes o presentaciones.",
  },
];

export default async function PublicHomePage() {
  const site = await prisma.siteContent.findFirst({
    where: { organization: { isPlatformOwner: true } },
    include: {
      services: { orderBy: { order: "asc" } },
      portfolioItems: {
        where: { published: true },
        orderBy: [{ featured: "desc" }, { order: "asc" }],
      },
      teamMembers: { orderBy: { order: "asc" } },
    },
  });

  const heroTitleLines = (site?.heroTitle ?? "Historias que\nse quedan.").split(
    "\n",
  );
  const heroSubtitle =
    site?.heroSubtitle ?? "Versión definitiva — de la idea al montaje final.";
  const tags = site?.marqueeTags.length ? site.marqueeTags : DEFAULT_TAGS;
  const servicios =
    site && site.services.length > 0
      ? site.services.map((s, i) => ({
          num: String(i + 1).padStart(2, "0"),
          title: s.title,
          description: s.description,
          details: s.details,
        }))
      : DEFAULT_SERVICIOS;
  const aboutQuestion = site?.aboutQuestion ?? "¿Qué historia merece contarse?";
  const aboutText =
    site?.aboutText ??
    "Somos un equipo pequeño que trabaja como uno grande: desde el guion hasta la entrega final, cuidando cada decisión de imagen, ritmo y sonido.";
  const contactEmail = site?.contactEmail ?? "hola@versiondefinitiva.com";
  const portfolioItems = site?.portfolioItems ?? [];
  const teamMembers = site?.teamMembers ?? [];

  return (
    <>
      <section className="relative h-screen w-full overflow-hidden">
        <PlaceholderFrame className="absolute inset-0">
          <div className="relative flex h-full flex-col">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-28 font-mono text-[11px] tracking-[0.25em] text-muted uppercase">
              <HeroReveal>
                <div className="flex items-center gap-2 text-accent">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  Productora audiovisual
                </div>
              </HeroReveal>
              <span className="hidden sm:inline">
                © {new Date().getFullYear()}
              </span>
            </div>

            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6">
              <HeroReveal>
                <h1 className="max-w-4xl font-display text-5xl leading-[0.95] font-black tracking-tight text-fg uppercase sm:text-7xl lg:text-[7rem]">
                  {heroTitleLines.map((line, i) => (
                    <span key={i}>
                      {line}
                      {i < heroTitleLines.length - 1 && <br />}
                    </span>
                  ))}
                </h1>
                <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
                  <p className="max-w-md font-mono text-sm text-muted">
                    {heroSubtitle}
                  </p>
                  <a
                    href="#portfolio"
                    className="group inline-flex items-center gap-2 border-b border-accent pb-0.5 font-mono text-xs tracking-widest text-fg uppercase transition-colors hover:text-accent"
                  >
                    Ver portfolio
                    <span className="transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </a>
                </div>
              </HeroReveal>
            </div>

            <div className="flex flex-col items-center gap-2 pb-8">
              <span className="font-mono text-[10px] tracking-[0.3em] text-muted uppercase">
                Scroll
              </span>
              <svg
                className="h-4 w-4 animate-bounce text-muted"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </PlaceholderFrame>
      </section>

      <div className="group flex w-full overflow-hidden border-y border-line bg-bg-raised py-4 [contain:layout_paint]">
        <div className="flex w-max animate-[credits-scroll_70s_linear_infinite] group-hover:[animation-play-state:paused]">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center gap-6 pr-6">
              {tags.map((tag, i) => (
                <span key={i} className="flex items-center gap-6">
                  <span className="font-mono text-sm tracking-widest whitespace-nowrap uppercase">
                    {tag}
                  </span>
                  <span className="text-accent">●</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section id="servicios" className="px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <span className="font-mono text-xs tracking-widest text-accent uppercase">
              Servicios
            </span>
          </Reveal>
          <div className="mt-8 border-t border-line">
            {servicios.map((servicio, i) => (
              <Reveal key={servicio.num} delay={i * 0.06}>
                {servicio.details ? (
                  <details className="group/service border-b border-line">
                    <summary className="grid cursor-pointer list-none grid-cols-[3rem_1fr_2fr_auto] items-baseline gap-6 py-6 pl-0 transition-all duration-300 [&::-webkit-details-marker]:hidden hover:pl-4 sm:grid-cols-[4rem_1fr_2fr_auto]">
                      <span className="font-mono text-sm text-muted transition-colors group-hover/service:text-accent">
                        {servicio.num}
                      </span>
                      <h3 className="font-display text-2xl font-bold uppercase transition-colors sm:text-3xl group-hover/service:text-accent">
                        {servicio.title}
                      </h3>
                      <p className="font-mono text-sm text-muted">
                        {servicio.description}
                      </p>
                      <span className="font-mono text-muted transition-transform duration-300 group-open/service:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="-mt-2 max-w-2xl pb-6 font-mono text-sm text-muted sm:pl-[calc(4rem+1.5rem)]">
                      {servicio.details}
                    </p>
                  </details>
                ) : (
                  <div className="group grid grid-cols-[3rem_1fr_2fr] items-baseline gap-6 border-b border-line py-6 pl-0 transition-all duration-300 hover:pl-4 sm:grid-cols-[4rem_1fr_2fr]">
                    <span className="font-mono text-sm text-muted transition-colors group-hover:text-accent">
                      {servicio.num}
                    </span>
                    <h3 className="font-display text-2xl font-bold uppercase transition-colors sm:text-3xl group-hover:text-accent">
                      {servicio.title}
                    </h3>
                    <p className="font-mono text-sm text-muted">
                      {servicio.description}
                    </p>
                  </div>
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="nosotros" className="border-t border-line px-6 py-28">
        <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-[2fr_1fr]">
          <Reveal>
            <p className="font-display text-3xl leading-tight font-bold uppercase sm:text-4xl">
              Cada proyecto empieza con una pregunta:{" "}
              <span className="text-accent">{aboutQuestion}</span>
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="font-mono text-sm text-muted">{aboutText}</p>
            {teamMembers.length > 0 && (
              <a
                href="/equipo"
                className="group mt-4 inline-flex items-center gap-2 border-b border-accent pb-0.5 font-mono text-xs tracking-widest text-fg uppercase transition-colors hover:text-accent"
              >
                Conoce al equipo
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </a>
            )}
          </Reveal>
        </div>
      </section>

      <section id="portfolio" className="border-t border-line px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <span className="font-mono text-xs tracking-widest text-accent uppercase">
              Portfolio
            </span>
          </Reveal>

          <PortfolioSection items={portfolioItems} />
        </div>
      </section>

      <section id="presupuesto" className="border-t border-line px-6 py-28">
        <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <span className="font-mono text-xs tracking-widest text-accent uppercase">
              Presupuesto
            </span>
            <p className="mt-4 font-display text-3xl leading-tight font-bold uppercase sm:text-4xl">
              ¿Tienes un proyecto en mente?
            </p>
            <p className="mt-4 max-w-md font-mono text-sm text-muted">
              Cada rodaje es distinto, así que no publicamos tarifas fijas.
              Cuéntanos la idea y te respondemos con un presupuesto ajustado
              en 24-48h, sin compromiso.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <BudgetRequestForm />
          </Reveal>
        </div>
      </section>

      <section
        id="contacto"
        className="border-t border-line bg-bg-raised px-6 py-28"
      >
        <div className="mx-auto max-w-6xl text-center">
          <Reveal>
            <h2 className="font-display text-4xl font-black uppercase sm:text-6xl">
              Hablemos.
            </h2>
            <a
              href={`mailto:${contactEmail}`}
              className="mt-8 inline-block border-b border-accent font-mono text-sm tracking-widest text-fg uppercase transition-colors hover:text-accent"
            >
              {contactEmail}
            </a>
          </Reveal>
        </div>
      </section>
    </>
  );
}
