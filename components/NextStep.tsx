import Link from "next/link";
import { AjoloteLogo } from "@/components/AjoloteLogo";
import { SubmitButton } from "@/components/SubmitButton";
import type { RoadmapStep } from "@/lib/project-roadmap";

// Por qué importa cada paso y cuánto cuesta, en lenguaje llano.
const COPY: Record<string, { why: string; time: string; cta?: string }> = {
  guion: { why: "Súbelo (PDF o Word) y la IA propone escenas, personajes y localizaciones: es la base de todo lo demás.", time: "2 min", cta: "Subir mi guion" },
  reparto: { why: "Saber quién hace de quién te permite organizar y avisar al equipo.", time: "1 min por personaje" },
  localizaciones: { why: "Con los lugares puedes agrupar escenas y ahorrar días de rodaje.", time: "2 min" },
  desglose: { why: "Lista lo que necesita cada escena (atrezzo, vestuario…) para no olvidar nada.", time: "5 min" },
  presupuesto: { why: "Ver cuánto cuesta el proyecto antes de empezar evita sustos. Te dejo preparadas las categorías típicas.", time: "5 min", cta: "Preparar mi presupuesto" },
  "plan-de-rodaje": { why: "Reparte las escenas en días de rodaje: es el calendario de tu rodaje. Yo te propongo uno y tú lo ajustas.", time: "2 min", cta: "Crear mi plan de rodaje" },
  "shot-list": { why: "Define los planos de cada escena para rodar sin dudas.", time: "10 min" },
  storyboard: { why: "Dibuja o sube viñetas de los planos clave.", time: "10 min" },
  "call-sheets": { why: "La hoja de llamada dice al equipo dónde y cuándo ir cada día, y se comparte con un enlace. Las creo todas de una vez.", time: "1 min", cta: "Generar mis hojas de llamada" },
};

function Marker({ step, current }: { step: RoadmapStep; current: boolean }) {
  if (step.isDone)
    return (
      <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-full bg-success text-[9px] text-bg">
        ✓
      </span>
    );
  if (current)
    return (
      <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      </span>
    );
  return <span aria-hidden className={`block h-4 w-4 rounded-full ${step.required ? "ring-1 ring-muted/60" : "ring-1 ring-line"}`} />;
}

// El único paso que toca ahora, grande y con un solo botón; el resto del camino, plegado.
export function NextStep({
  steps,
  startShootAction,
}: {
  steps: RoadmapStep[];
  // Si se pasa, cuando todo lo esencial está listo se ofrece pasar el proyecto a «rodaje».
  startShootAction?: () => Promise<void>;
}) {
  const required = steps.filter((s) => s.required);
  const requiredDone = required.filter((s) => s.isDone).length;
  const next = steps.find((s) => s.required && !s.isDone) ?? null;
  const optional = next ? null : (steps.find((s) => !s.isDone) ?? null);
  const focus = next ?? optional;
  const copy = focus ? COPY[focus.key] : undefined;

  const pct = required.length > 0 ? Math.round((requiredDone / required.length) * 100) : 0;

  // Una sola hoja: a la izquierda lo que toca ahora (grande, con un botón); a la derecha el
  // camino entero, siempre visible, para saber cuánto falta sin tener que desplegar nada.
  return (
    <section
      aria-labelledby="next-step-title"
      className="paper mt-8 grid overflow-hidden lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
    >
      <div className="flex gap-5 p-6 sm:p-8">
        <AjoloteLogo className="hidden h-16 w-auto shrink-0 sm:block" />
        <div className="min-w-0 flex-1">
          {next ? (
            <>
              <p className="eyebrow text-accent">
                Siguiente paso{copy ? ` · ${copy.time}` : ""}
              </p>
              <h2 id="next-step-title" className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
                {next.title}
              </h2>
              <p className="mt-3 max-w-xl font-sans text-[15px] leading-relaxed text-muted">{copy?.why ?? next.instruction}</p>
              <p className="mt-3 flex items-center gap-2 font-sans text-xs text-muted">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warn" />
                {next.detail}
              </p>
              <Link href={next.href} className="btn btn-primary mt-6">
                {copy?.cta ?? next.ctaLabel} →
              </Link>
            </>
          ) : (
            <>
              <p className="eyebrow text-success">Listo para rodar</p>
              <h2 id="next-step-title" className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
                Has completado lo esencial
              </h2>
              <p className="mt-3 max-w-xl font-sans text-[15px] leading-relaxed text-muted">
                {optional ? `Aún puedes mejorar el proyecto: ${optional.title.toLowerCase()}.` : "Y también todos los pasos opcionales."}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {startShootAction && (
                  <form action={startShootAction}>
                    <SubmitButton pendingLabel="Cambiando…" className="btn btn-primary">
                      Empezar el rodaje →
                    </SubmitButton>
                  </form>
                )}
                {optional && (
                  <Link href={optional.href} className="btn btn-outline">
                    {optional.ctaLabel} →
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-line p-6 sm:p-8 lg:border-t-0 lg:border-l">
        <div className="flex items-baseline justify-between gap-3">
          <p className="eyebrow">El camino</p>
          <p className="font-mono text-[11px] text-muted">
            <span className="text-fg">{requiredDone}</span>/{required.length} esenciales
          </p>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden>
          <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
        <ul className="mt-4 space-y-0.5">
          {steps.map((s) => {
            const current = s.key === focus?.key;
            return (
              <li key={s.key}>
                <Link
                  href={s.href}
                  aria-current={current ? "step" : undefined}
                  className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-bg"
                >
                  <Marker step={s} current={current} />
                  <span
                    className={`min-w-0 flex-1 truncate font-sans text-sm ${
                      s.isDone ? "text-muted line-through decoration-line" : current ? "font-semibold text-fg" : "text-fg"
                    }`}
                  >
                    {s.title}
                  </span>
                  {!s.required && <span className="shrink-0 font-mono text-[9px] tracking-widest text-muted uppercase">Opcional</span>}
                  <span aria-hidden className="shrink-0 text-xs text-accent opacity-0 transition-opacity group-hover:opacity-100">
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
