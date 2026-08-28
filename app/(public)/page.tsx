import { AjoloteLogo } from "@/components/AjoloteLogo";
import { Reveal } from "@/components/Reveal";

const SERVICIOS = [
  {
    title: "Ficción",
    description:
      "Cortometrajes y largometrajes, del guion al montaje final.",
  },
  {
    title: "Publicidad",
    description: "Spots y branded content con una mirada cinematográfica.",
  },
  {
    title: "Documental",
    description: "Historias reales contadas con tiempo y cuidado.",
  },
  {
    title: "Corporativo",
    description: "Vídeo institucional, eventos y contenido de marca.",
  },
];

const PROYECTOS = [
  { title: "Próximamente", category: "Ficción" },
  { title: "Próximamente", category: "Publicidad" },
  { title: "Próximamente", category: "Documental" },
];

export default function PublicHomePage() {
  return (
    <>
      <section className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-6 pb-24 pt-20 text-center sm:pt-28">
        <AjoloteLogo className="h-40 w-auto sm:h-52" />
        <div className="max-w-2xl space-y-5">
          <h1 className="font-display text-4xl leading-tight text-balance sm:text-5xl">
            Contamos historias en imagen
          </h1>
          <p className="font-sans text-lg text-ink/70 text-balance">
            Somos Versión definitiva: una productora audiovisual que
            acompaña cada proyecto de la idea al montaje final.
          </p>
        </div>
        <a
          href="#portfolio"
          className="rounded-full bg-ink px-7 py-3 font-sans text-sm font-medium text-paper transition-colors hover:bg-accent"
        >
          Ver portfolio
        </a>
      </section>

      <section id="servicios" className="border-t border-ink/10 bg-paper-soft">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <h2 className="font-display text-3xl">Servicios</h2>
          </Reveal>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICIOS.map((servicio, i) => (
              <Reveal key={servicio.title} delay={i * 0.08}>
                <div className="border-t-2 border-accent pt-4">
                  <h3 className="font-display text-xl">{servicio.title}</h3>
                  <p className="mt-2 font-sans text-sm text-ink/70">
                    {servicio.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="portfolio" className="border-t border-ink/10">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <h2 className="font-display text-3xl">Portfolio destacado</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {PROYECTOS.map((proyecto, i) => (
              <Reveal key={proyecto.title + i} delay={i * 0.08}>
                <div className="group relative aspect-video overflow-hidden rounded-lg bg-ink text-paper">
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                    <span className="font-sans text-xs tracking-widest uppercase text-paper/60">
                      {proyecto.category}
                    </span>
                    <span className="font-display text-lg">
                      {proyecto.title}
                    </span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section
        id="contacto"
        className="border-t border-ink/10 bg-paper-soft"
      >
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <Reveal>
            <h2 className="font-display text-3xl">Hablemos de tu proyecto</h2>
            <p className="mt-4 font-sans text-ink/70">
              Cuéntanos qué tienes en mente y te respondemos en breve.
            </p>
            <a
              href="mailto:hola@versiondefinitiva.com"
              className="mt-8 inline-block rounded-full border border-ink px-7 py-3 font-sans text-sm font-medium transition-colors hover:border-accent hover:text-accent"
            >
              hola@versiondefinitiva.com
            </a>
          </Reveal>
        </div>
      </section>
    </>
  );
}
