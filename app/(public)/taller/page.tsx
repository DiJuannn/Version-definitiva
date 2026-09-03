import Link from "next/link";
import { PlaceholderFrame } from "@/components/PlaceholderFrame";
import { Reveal } from "@/components/Reveal";
import { FREE_FEATURES, PRO_FEATURES } from "@/lib/plan-features";
import {
  BudgetIcon,
  CalendarIcon,
  CastIcon,
  DocumentIcon,
  LocationIcon,
  ProjectsIcon,
  SceneIcon,
  ShotListIcon,
} from "@/components/ToolIcons";

const HERRAMIENTAS = [
  { icon: <DocumentIcon />, label: "Guion" },
  { icon: <ProjectsIcon />, label: "Desglose" },
  { icon: <CastIcon />, label: "Personajes y actores" },
  { icon: <LocationIcon />, label: "Localizaciones" },
  { icon: <CalendarIcon />, label: "Plan de rodaje" },
  { icon: <DocumentIcon />, label: "Call sheets" },
  { icon: <ShotListIcon />, label: "Shot list" },
  { icon: <SceneIcon />, label: "Storyboard" },
  { icon: <BudgetIcon />, label: "Presupuesto" },
  { icon: <DocumentIcon />, label: "Biblioteca de archivos" },
];

const EJEMPLOS = [
  { label: "Call sheet", category: "Documento de rodaje" },
  { label: "Plan de rodaje", category: "Planificación" },
  { label: "Presupuesto", category: "Producción" },
  { label: "Storyboard", category: "Preproducción" },
  { label: "Shot list", category: "Cámara" },
  { label: "Desglose", category: "Guion" },
];

const FLUJO = [
  "Guion",
  "Desglose",
  "Plan de rodaje",
  "Call sheet",
  "Shot list",
  "Storyboard",
  "Documentación",
];

export default function TallerMarketingPage() {
  return (
    <>
      <section className="relative overflow-hidden px-6 pb-20 pt-40">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="mb-6 flex items-center gap-2 font-mono text-xs tracking-[0.25em] text-accent uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Producto — Taller
            </div>
            <h1 className="max-w-3xl font-display text-6xl leading-[0.95] font-black tracking-tight text-fg uppercase sm:text-7xl">
              El taller de tu
              <br />
              próxima producción.
            </h1>
            <p className="mt-6 max-w-xl font-mono text-sm text-muted">
              Taller es nuestro espacio digital de producción audiovisual,
              diseñado para organizar un proyecto desde el guion hasta el
              rodaje. Guion, desglose, planificación, call sheets, shot list y
              storyboard, todo conectado en un mismo sitio.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/app/signup"
                className="group relative overflow-hidden border border-accent bg-accent px-6 py-3 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
              >
                Probar Taller
              </Link>
              <Link
                href="/app/login"
                className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
              >
                Ya tengo cuenta →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-line px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <span className="font-mono text-xs tracking-widest text-accent uppercase">
              Qué incluye
            </span>
          </Reveal>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {HERRAMIENTAS.map((tool, i) => (
              <Reveal key={tool.label} delay={i * 0.03}>
                <div className="flex aspect-square flex-col items-center justify-center gap-3 border border-line p-4 text-center">
                  <div className="h-8 w-8 text-muted">{tool.icon}</div>
                  <span className="font-display text-sm font-bold uppercase">
                    {tool.label}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-bg-raised px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <span className="font-mono text-xs tracking-widest text-accent uppercase">
              Un flujo, no herramientas sueltas
            </span>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-4 font-mono text-xs tracking-widest uppercase sm:text-sm">
              {FLUJO.map((paso, i) => (
                <span key={paso} className="flex items-center gap-3">
                  <span className="border border-line px-3 py-1.5">
                    {paso}
                  </span>
                  {i < FLUJO.length - 1 && (
                    <span className="text-muted">→</span>
                  )}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-8 max-w-2xl font-mono text-sm text-muted">
              La información se reutiliza entre herramientas: la escena que
              desglosas es la misma que asignas a un día de rodaje, y el mismo
              día genera el call sheet automáticamente. Una sola fuente de
              datos, sin volver a escribir nada dos veces.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-line px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <span className="font-mono text-xs tracking-widest text-accent uppercase">
              Ejemplos
            </span>
          </Reveal>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {EJEMPLOS.map((ejemplo, i) => (
              <Reveal key={ejemplo.label} delay={i * 0.06}>
                <PlaceholderFrame className="aspect-video transition-transform duration-500 hover:scale-[1.03]">
                  <div className="absolute inset-0 flex flex-col items-start justify-end p-5">
                    <div className="font-mono text-[11px] tracking-widest text-accent uppercase">
                      {ejemplo.category}
                    </div>
                    <div className="mt-1 font-display text-lg font-bold uppercase">
                      {ejemplo.label}
                    </div>
                  </div>
                </PlaceholderFrame>
              </Reveal>
            ))}
          </div>
          <p className="mt-6 font-mono text-xs text-muted">
            Ejemplos ilustrativos — algunas de estas herramientas todavía
            están en construcción.
          </p>
        </div>
      </section>

      <section className="border-t border-line bg-bg-raised px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="border border-accent/40 px-6 py-8 sm:px-10 sm:py-10">
              <span className="font-mono text-xs tracking-widest text-accent uppercase">
                Próximamente
              </span>
              <p className="mt-4 max-w-2xl font-display text-2xl font-bold uppercase sm:text-3xl">
                Guion → IA → desglose automático, plan de rodaje propuesto y
                shot list sugerida.
              </p>
              <p className="mt-4 max-w-2xl font-mono text-sm text-muted">
                La IA será una capa adicional que propone, no una dependencia
                necesaria: Taller funciona completo sin ella desde el primer
                día.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="precios" className="scroll-mt-24 border-t border-line px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <span className="font-mono text-xs tracking-widest text-accent uppercase">
              Precios
            </span>
            <h2 className="mt-4 max-w-2xl font-display text-4xl font-black uppercase sm:text-5xl">
              Elige cómo trabajas.
            </h2>
            <p className="mt-4 max-w-xl font-mono text-sm text-muted">
              Empieza gratis. Pásate a PRO cuando el proyecto lo pida — sin
              perder nada de lo que ya tienes montado.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <Reveal delay={0.05}>
              <div className="flex h-full flex-col border border-line p-8">
                <span className="font-mono text-xs tracking-widest text-muted uppercase">
                  Gratis
                </span>
                <p className="mt-3 font-display text-4xl font-black">0€</p>
                <ul className="mt-8 space-y-3 font-mono text-sm text-muted">
                  {FREE_FEATURES.map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <span>·</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/app/signup"
                  className="mt-8 inline-block self-start border border-line px-5 py-2.5 font-mono text-xs tracking-widest uppercase transition-colors hover:border-accent hover:text-accent"
                >
                  Empieza gratis
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="flex h-full flex-col border border-accent p-8">
                <span className="font-mono text-xs tracking-widest text-accent uppercase">
                  PRO
                </span>
                <p className="mt-3 font-display text-4xl font-black">
                  6,99€
                  <span className="font-mono text-sm font-normal text-muted">
                    {" "}
                    /mes
                  </span>
                </p>
                <p className="mt-1 font-mono text-xs tracking-widest text-accent uppercase">
                  o 69,99€/año — 2 meses gratis
                </p>
                <ul className="mt-8 space-y-3 font-mono text-sm text-muted">
                  {PRO_FEATURES.map((feature) => (
                    <li key={feature} className="flex gap-2.5">
                      <span className="text-accent">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/app/signup"
                  className="mt-8 inline-block self-start border border-accent bg-accent px-5 py-2.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
                >
                  Empieza gratis
                </Link>
              </div>
            </Reveal>
          </div>

          <p className="mt-6 font-mono text-xs text-muted">
            El pago se activa dentro del Taller, desde Organización — la
            cuenta empieza siempre en el plan gratuito.
          </p>
        </div>
      </section>

      <section className="border-t border-line px-6 py-28 text-center">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="font-display text-4xl font-black uppercase sm:text-6xl">
              Organiza tu próximo rodaje.
            </h2>
            <p className="mt-4 font-mono text-sm text-muted">
              Para cualquier persona o productora — también para la nuestra.
            </p>
            <Link
              href="/app/signup"
              className="mt-8 inline-block border border-accent bg-accent px-6 py-3 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
            >
              Probar Taller
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
