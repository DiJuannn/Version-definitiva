import { Marquee } from "@/components/Marquee";
import { PlaceholderFrame } from "@/components/PlaceholderFrame";
import { Reveal } from "@/components/Reveal";

const TAGS = [
  "FICCIÓN",
  "PUBLICIDAD",
  "DOCUMENTAL",
  "CORPORATIVO",
  "COLOR",
  "SONIDO",
  "MONTAJE",
];

const SERVICIOS = [
  {
    num: "01",
    title: "Ficción",
    description: "Cortometrajes y largometrajes, del guion al montaje final.",
  },
  {
    num: "02",
    title: "Publicidad",
    description: "Spots y branded content con mirada cinematográfica.",
  },
  {
    num: "03",
    title: "Documental",
    description: "Historias reales, contadas con tiempo y cuidado.",
  },
  {
    num: "04",
    title: "Corporativo",
    description: "Vídeo institucional, eventos y contenido de marca.",
  },
];

const PROYECTOS = [
  { category: "Ficción", title: "Proyecto 01" },
  { category: "Publicidad", title: "Proyecto 02" },
  { category: "Documental", title: "Proyecto 03" },
  { category: "Corporativo", title: "Proyecto 04" },
  { category: "Ficción", title: "Proyecto 05" },
  { category: "Publicidad", title: "Proyecto 06" },
];

export default function PublicHomePage() {
  return (
    <>
      <section className="relative h-screen w-full">
        <PlaceholderFrame className="absolute inset-0">
          <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end px-6 pb-20 pt-32">
            <div className="mb-6 flex items-center gap-2 font-mono text-xs tracking-[0.25em] text-accent uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Productora audiovisual
            </div>
            <h1 className="max-w-3xl font-display text-6xl leading-[0.95] font-black tracking-tight text-fg uppercase sm:text-7xl lg:text-8xl">
              Historias que
              <br />
              se quedan.
            </h1>
            <p className="mt-6 max-w-md font-mono text-sm text-muted">
              Versión definitiva — de la idea al montaje final.
            </p>
          </div>
          <div className="absolute bottom-8 right-6 flex items-center gap-3 font-mono text-[11px] tracking-widest text-muted uppercase">
            <span className="h-8 w-px bg-line" />
            Scroll
          </div>
        </PlaceholderFrame>
      </section>

      <div className="border-y border-line bg-bg-raised py-4">
        <Marquee items={TAGS} />
      </div>

      <section id="servicios" className="px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <span className="font-mono text-xs tracking-widest text-accent uppercase">
              Servicios
            </span>
          </Reveal>
          <div className="mt-8 border-t border-line">
            {SERVICIOS.map((servicio, i) => (
              <Reveal key={servicio.num} delay={i * 0.06}>
                <div className="grid grid-cols-[3rem_1fr_2fr] items-baseline gap-6 border-b border-line py-6 sm:grid-cols-[4rem_1fr_2fr]">
                  <span className="font-mono text-sm text-muted">
                    {servicio.num}
                  </span>
                  <h3 className="font-display text-2xl font-bold uppercase sm:text-3xl">
                    {servicio.title}
                  </h3>
                  <p className="font-mono text-sm text-muted">
                    {servicio.description}
                  </p>
                </div>
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
              <span className="text-accent">¿qué historia merece contarse?</span>
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="font-mono text-sm text-muted">
              Somos un equipo pequeño que trabaja como uno grande: desde el
              guion hasta la entrega final, cuidando cada decisión de imagen,
              ritmo y sonido.
            </p>
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

          <Reveal delay={0.1}>
            <PlaceholderFrame className="mt-8 aspect-[16/8]">
              <div className="absolute left-6 top-6 font-mono text-[11px] tracking-widest text-accent uppercase">
                En producción
              </div>
              <div className="absolute bottom-6 left-6">
                <div className="font-mono text-xs tracking-widest text-muted uppercase">
                  Ficción
                </div>
                <div className="mt-1 font-display text-3xl font-bold uppercase sm:text-4xl">
                  Proyecto destacado
                </div>
              </div>
              <div className="absolute bottom-6 right-6 font-mono text-xs tracking-widest text-fg uppercase">
                Explorar →
              </div>
            </PlaceholderFrame>
          </Reveal>

          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {PROYECTOS.map((proyecto, i) => (
              <Reveal key={proyecto.title} delay={i * 0.06}>
                <PlaceholderFrame className="aspect-video">
                  <div className="absolute inset-0 flex flex-col items-start justify-end p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="font-mono text-[11px] tracking-widest text-accent uppercase">
                      {proyecto.category}
                    </div>
                    <div className="mt-1 font-display text-lg font-bold uppercase">
                      {proyecto.title}
                    </div>
                  </div>
                </PlaceholderFrame>
              </Reveal>
            ))}
          </div>
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
              href="mailto:hola@versiondefinitiva.com"
              className="mt-8 inline-block border-b border-accent font-mono text-sm tracking-widest text-fg uppercase transition-colors hover:text-accent"
            >
              hola@versiondefinitiva.com
            </a>
          </Reveal>
        </div>
      </section>
    </>
  );
}
