import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Reveal } from "@/components/Reveal";
import { MediaFrame } from "@/components/MediaFrame";
import {
  CalendarIcon,
  DocumentIcon,
  ShotListIcon,
} from "@/components/ToolIcons";

type Credit = { role: string; value: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await prisma.portfolioItem.findFirst({
    where: { slug, published: true, siteContent: { organization: { isPlatformOwner: true } } },
  });
  return { title: item?.title ?? "Proyecto" };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const site = await prisma.siteContent.findFirst({
    where: { organization: { isPlatformOwner: true } },
    include: {
      portfolioItems: {
        where: { published: true },
        orderBy: [{ featured: "desc" }, { order: "asc" }],
        include: { images: { orderBy: { order: "asc" } } },
      },
    },
  });

  const items = site?.portfolioItems ?? [];
  const index = items.findIndex((p) => p.slug === slug);
  const item = index >= 0 ? items[index] : null;

  if (!item) notFound();

  const next = items.length > 1 ? items[(index + 1) % items.length] : null;
  const credits = Array.isArray(item.credits) ? (item.credits as Credit[]) : [];
  const frames = item.images.filter((img) => img.kind === "FRAME");
  const bts = item.images.filter((img) => img.kind === "BTS");

  return (
    <>
      <section className="relative h-[85vh] w-full overflow-hidden">
        <MediaFrame
          src={item.heroImageUrl}
          alt={item.title}
          label={`${item.title} — fotograma principal`}
          className="absolute inset-0"
          priority
          sizes="100vw"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/10 to-bg/40" />
        <div className="relative flex h-full flex-col justify-end px-6 pb-16">
          <div className="mx-auto w-full max-w-6xl">
            <Reveal>
              <span className="font-mono text-xs tracking-widest text-accent uppercase">
                {[item.category, item.genre, item.year].filter(Boolean).join(" · ")}
              </span>
              <h1 className="mt-4 max-w-4xl font-display text-5xl leading-[0.95] font-black tracking-tight text-fg uppercase sm:text-7xl">
                {item.title}
              </h1>
            </Reveal>
          </div>
        </div>
      </section>

      {(item.logline || item.synopsis) && (
        <section className="border-t border-line px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <Reveal>
              {item.logline && (
                <p className="font-display text-2xl leading-tight font-bold uppercase sm:text-3xl">
                  {item.logline}
                </p>
              )}
              {item.synopsis && (
                <p className="mt-6 font-mono text-sm leading-relaxed text-muted">
                  {item.synopsis}
                </p>
              )}
            </Reveal>
          </div>
        </section>
      )}

      {credits.length > 0 && (
        <section className="border-t border-line bg-bg-raised px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <div className="grid gap-x-8 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
                {credits.map((credit) => (
                  <div key={credit.role}>
                    <span className="font-mono text-[10px] tracking-widest text-accent-purple-soft uppercase">
                      {credit.role}
                    </span>
                    <p className="mt-1 font-display text-sm font-bold uppercase">
                      {credit.value}
                    </p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {frames.length > 0 && (
        <section className="border-t border-line py-20">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6">
            {frames.map((frame, i) => {
              // Composición editorial: una grande, luego pareja, luego
              // ancho completo, repitiendo — nunca una cuadrícula uniforme.
              const cycle = i % 3;
              if (cycle === 0) {
                return (
                  <Reveal key={frame.id}>
                    <MediaFrame
                      src={frame.url}
                      alt={`${item.title} — fotograma`}
                      label="Fotograma"
                      className="aspect-[16/9]"
                    />
                  </Reveal>
                );
              }
              if (cycle === 1) {
                const partner = frames[i + 1];
                return (
                  <Reveal key={frame.id}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <MediaFrame
                        src={frame.url}
                        alt={`${item.title} — fotograma`}
                        label="Fotograma"
                        className="aspect-[3/4]"
                      />
                      {partner && (
                        <MediaFrame
                          src={partner.url}
                          alt={`${item.title} — fotograma`}
                          label="Fotograma"
                          className="aspect-[3/4]"
                        />
                      )}
                    </div>
                  </Reveal>
                );
              }
              return null; // el "partner" del ciclo anterior ya se pintó
            })}
          </div>
        </section>
      )}

      {bts.length > 0 && (
        <section className="border-t border-line bg-bg-raised px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <span className="font-mono text-xs tracking-widest text-accent-purple-soft uppercase">
                Behind the scenes
              </span>
              <p className="mt-3 font-display text-2xl font-bold uppercase sm:text-3xl">
                Cómo lo hicimos.
              </p>
            </Reveal>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {bts.map((photo, i) => (
                <Reveal key={photo.id} delay={i * 0.05}>
                  <MediaFrame
                    src={photo.url}
                    alt={`${item.title} — behind the scenes`}
                    label="BTS"
                    className="aspect-[4/3]"
                  />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {item.videoUrl && (
        <section className="border-t border-line px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <div className="relative aspect-video overflow-hidden border border-line">
                <iframe
                  src={item.videoUrl}
                  title={item.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {item.usesTaller && (
        <section className="border-t border-line bg-bg-raised px-6 py-20">
          <div className="mx-auto max-w-4xl">
            <Reveal>
              <span className="font-mono text-xs tracking-widest text-accent-purple-soft uppercase">
                Del guion al rodaje
              </span>
              <p className="mt-3 font-display text-2xl font-bold uppercase sm:text-3xl">
                Este proyecto se organizó con Taller.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3 font-mono text-xs tracking-widest uppercase">
                {["Guion", "Shot list", "Plan de rodaje", "Call sheet", "Fotograma final"].map(
                  (step, i, arr) => (
                    <span key={step} className="flex items-center gap-3">
                      <span className="border border-line px-3 py-1.5">{step}</span>
                      {i < arr.length - 1 && <span className="text-muted">→</span>}
                    </span>
                  ),
                )}
              </div>
              {item.tallerNote && (
                <p className="mt-6 max-w-2xl font-mono text-sm text-muted">
                  {item.tallerNote}
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-4 font-mono text-[10px] tracking-widest text-muted uppercase">
                <span className="flex items-center gap-1.5">
                  <DocumentIcon className="h-4 w-4" /> Guion y desglose
                </span>
                <span className="flex items-center gap-1.5">
                  <ShotListIcon className="h-4 w-4" /> Shot list
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="h-4 w-4" /> Plan de rodaje
                </span>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {next && (
        <Link
          href={`/proyectos/${next.slug}`}
          className="group relative block h-[50vh] w-full overflow-hidden border-t border-line"
        >
          <MediaFrame
            src={next.heroImageUrl}
            alt={next.title}
            label={`${next.title} — fotograma principal`}
            className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-0 bg-bg/60" />
          <div className="relative flex h-full flex-col items-center justify-center text-center">
            <span className="font-mono text-xs tracking-widest text-accent uppercase">
              Siguiente proyecto
            </span>
            <p className="mt-3 font-display text-4xl font-black uppercase sm:text-6xl">
              {next.title} →
            </p>
          </div>
        </Link>
      )}
    </>
  );
}
