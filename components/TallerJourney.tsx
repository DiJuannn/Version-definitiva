"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type Stage = { kicker: string; title: string; text: string; visual: ReactNode };

// Maquetas mínimas de cada etapa (solo forma, sin datos reales): se leen de
// un vistazo y no compiten con el texto.
function Line({ w, accent = false }: { w: string; accent?: boolean }) {
  return <span className={`block h-1.5 ${accent ? "bg-accent" : "bg-line"}`} style={{ width: w }} />;
}

const STAGES: Stage[] = [
  {
    kicker: "01 · Guion",
    title: "Sube el guion y Taller lo desglosa",
    text: "La IA lee tu guion y propone escenas, personajes, localizaciones y lo que necesita cada escena. Lo revisas y lo importas.",
    visual: (
      <div className="space-y-3">
        <p className="font-mono text-[10px] tracking-widest text-accent uppercase">Esc. 4 — Int. Faro — Noche</p>
        <Line w="90%" />
        <Line w="75%" />
        <div className="flex flex-wrap gap-2 pt-1">
          {["Sara", "Samuel", "Linterna", "Faro"].map((t) => (
            <span key={t} className="border border-accent px-2 py-0.5 font-mono text-[10px] text-accent uppercase">
              {t}
            </span>
          ))}
        </div>
        <Line w="60%" />
      </div>
    ),
  },
  {
    kicker: "02 · Preproducción",
    title: "Planos, storyboard y equipo, en un sitio",
    text: "Lista de planos por escena (o importa tu guion técnico), storyboard, localizaciones con mapa y el equipo técnico de cada día.",
    visual: (
      <div className="divide-y divide-line border border-line">
        {[
          ["4.1", "PG", "Sara entra en el faro"],
          ["4.2", "PP", "Rostro de Sara"],
          ["4.3", "PD", "La linterna se apaga"],
        ].map(([n, s, d]) => (
          <div key={n} className="grid grid-cols-[2.5rem_2rem_1fr] gap-2 px-3 py-2 font-mono text-[10px]">
            <span className="text-accent">{n}</span>
            <span>{s}</span>
            <span className="truncate text-muted">{d}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    kicker: "03 · Plan de rodaje",
    title: "Días de rodaje y hojas de llamada solas",
    text: "Reparte escenas o planos sueltos por día y Taller prepara la hoja de llamada: quién va, dónde y a qué hora. Se comparte por WhatsApp.",
    visual: (
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className={`aspect-square border ${[1, 4, 7].includes(i) ? "border-accent bg-accent/15" : "border-line"}`} />
        ))}
        <p className="col-span-5 pt-2 font-mono text-[10px] tracking-widest text-muted uppercase">
          Hoja de llamada · 07:45 · Faro de Sant Sebastià
        </p>
      </div>
    ),
  },
  {
    kicker: "04 · Rodaje",
    title: "Claqueta y parte de script en el móvil",
    text: "Escena, plano, toma y clip de cámara que suben solos. Cada toma queda en el parte de script, con las buenas marcadas.",
    visual: (
      <div>
        <div
          className="h-6 border border-fg"
          style={{ backgroundImage: "repeating-linear-gradient(135deg, #f2f0ea 0 10px, #0a0a0a 10px 20px)" }}
        />
        <div className="grid grid-cols-3 border border-t-0 border-fg bg-black px-3 py-3 font-mono">
          {[
            ["Escena", "4"],
            ["Plano", "2"],
            ["Toma", "3"],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] tracking-widest text-fg/50 uppercase">{k}</p>
              <p className={`font-display text-2xl font-black ${k === "Toma" ? "text-accent" : "text-fg"}`}>{v}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    kicker: "05 · Posproducción",
    title: "Montaje, créditos y festivales",
    text: "Las tomas buenas listas para el montaje, la checklist de entrega, los créditos generados con tu reparto y equipo, y el seguimiento de festivales.",
    visual: (
      <div className="space-y-2 text-center font-mono text-[10px] tracking-widest uppercase">
        <p className="text-muted">Dirección</p>
        <p className="font-display text-sm text-fg">Ana Ruiz</p>
        <p className="pt-2 text-muted">Reparto</p>
        <p className="font-display text-sm text-fg">Sara — Muriel López</p>
        <p className="pt-2 text-accent">Seleccionado · Alcine</p>
      </div>
    ),
  },
];

// "Del guion a la pantalla": las cinco etapas de Taller.
// - Sin animación (móvil, "reducir movimiento", sin JavaScript): una lista
//   normal, todo legible de arriba abajo.
// - En escritorio con animación: la sección se queda fija y, al hacer scroll,
//   las etapas se suceden en el mismo sitio con una barra de progreso.
// El texto de las cinco etapas está siempre en la página (lector de pantalla
// y buscadores lo leen entero); la animación solo cambia cuál se ve.
export function TallerJourney() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const el = root.current;
        if (!el) return;
        const stages = gsap.utils.toArray<HTMLElement>("[data-stage]", el);
        const dots = gsap.utils.toArray<HTMLElement>("[data-dot]", el);
        el.classList.add("is-pinned");

        gsap.set(stages.slice(1), { autoAlpha: 0, y: 40 });
        gsap.set(dots.slice(1), { opacity: 0.3 });

        const tl = gsap.timeline({
          defaults: { ease: "power2.out", duration: 1 },
          scrollTrigger: {
            trigger: el.querySelector("[data-pin]"),
            start: "top top",
            end: () => `+=${window.innerHeight * (stages.length - 1) * 0.8}`,
            pin: true,
            scrub: 0.6,
            // Se asienta en una etapa entera, nunca a medias entre dos.
            // inertia: false = a la etapa más cercana, no a la que "predice" la
            // velocidad del scroll (con un trackpad rápido se saltaba etapas).
            snap: { snapTo: 1 / (stages.length - 1), duration: 0.4, ease: "power1.inOut", inertia: false },
            invalidateOnRefresh: true,
          },
        });
        tl.fromTo(el.querySelector("[data-progress]"), { scaleY: 0 }, { scaleY: 1, ease: "none", duration: stages.length - 1 }, 0);
        stages.forEach((stage, i) => {
          if (i === 0) return;
          const at = i - 1;
          tl.to(stages[i - 1], { autoAlpha: 0, y: -40 }, at)
            .to(stage, { autoAlpha: 1, y: 0 }, at)
            .to(dots[i - 1], { opacity: 0.3 }, at)
            .to(dots[i], { opacity: 1 }, at);
        });

        return () => el.classList.remove("is-pinned");
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="journey-title" className="taller-journey border-t border-line">
      <div data-pin className="journey-pin mx-auto max-w-6xl px-6 py-24">
        <span className="font-mono text-xs tracking-widest text-accent uppercase">Cómo funciona</span>
        <h2 id="journey-title" className="mt-3 max-w-2xl font-display text-4xl font-black uppercase sm:text-5xl">
          Del guion a la pantalla
        </h2>

        <div className="journey-body mt-12 lg:grid lg:grid-cols-[1.5rem_1fr] lg:gap-8">
          {/* Barra de progreso (solo se usa en la versión fija). */}
          <div aria-hidden className="journey-rail relative hidden">
            <div className="absolute inset-y-0 left-[0.6875rem] w-px bg-line" />
            <div data-progress className="absolute inset-y-0 left-[0.6875rem] w-px origin-top bg-accent" />
            <div className="relative flex h-full flex-col justify-between">
              {STAGES.map((s) => (
                <span key={s.kicker} data-dot className="h-3 w-3 rounded-full border border-accent bg-bg" />
              ))}
            </div>
          </div>

          <ol className="journey-stages space-y-16">
            {STAGES.map((stage) => (
              <li
                key={stage.kicker}
                data-stage
                className="journey-stage grid items-center gap-8 lg:grid-cols-2"
              >
                <div>
                  <p className="font-mono text-xs tracking-widest text-accent uppercase">{stage.kicker}</p>
                  <h3 className="mt-3 font-display text-3xl font-black uppercase">{stage.title}</h3>
                  <p className="mt-4 max-w-md text-muted">{stage.text}</p>
                </div>
                <div aria-hidden className="border border-line bg-bg-raised p-6">
                  {stage.visual}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
