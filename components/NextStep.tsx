import Link from "next/link";
import { AjoloteLogo } from "@/components/AjoloteLogo";
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
  if (step.isDone) return <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-full bg-success/15 text-[9px] text-success">✓</span>;
  if (current) return <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-full border border-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" /></span>;
  return <span aria-hidden className={`h-4 w-4 rounded-full border ${step.required ? "border-muted/60" : "border-dashed border-muted/40"}`} />;
}

// El único paso que toca ahora, grande y con un solo botón; el resto del camino, plegado.
export function NextStep({ steps }: { steps: RoadmapStep[] }) {
  const required = steps.filter((s) => s.required);
  const requiredDone = required.filter((s) => s.isDone).length;
  const next = steps.find((s) => s.required && !s.isDone) ?? null;
  const optional = next ? null : (steps.find((s) => !s.isDone) ?? null);
  const focus = next ?? optional;
  const copy = focus ? COPY[focus.key] : undefined;

  return (
    <section aria-labelledby="next-step-title" className="mt-6 border border-accent/40 bg-bg-raised/40 p-6 sm:p-8">
      <div className="flex items-start gap-5">
        <AjoloteLogo className="hidden h-16 w-auto shrink-0 sm:block" />
        <div className="min-w-0 flex-1">
          {next ? (
            <>
              <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
                Siguiente paso{copy ? ` · ${copy.time}` : ""}
              </p>
              <h2 id="next-step-title" className="mt-1.5 font-display text-2xl font-black tracking-tight sm:text-3xl">
                {next.title}
              </h2>
              <p className="mt-3 max-w-xl font-sans text-sm text-muted">{copy?.why ?? next.instruction}</p>
              <p className="mt-1 font-mono text-xs text-muted">{next.detail}</p>
              <Link href={next.href} className="btn btn-primary mt-5">
                {copy?.cta ?? next.ctaLabel} →
              </Link>
            </>
          ) : (
            <>
              <p className="font-mono text-[11px] tracking-widest text-success uppercase">Listo para rodar</p>
              <h2 id="next-step-title" className="mt-1.5 font-display text-2xl font-black tracking-tight sm:text-3xl">
                Has completado lo esencial
              </h2>
              <p className="mt-3 max-w-xl font-sans text-sm text-muted">
                {optional ? `Aún puedes mejorar el proyecto: ${optional.title.toLowerCase()}.` : "Y también todos los pasos opcionales."}
              </p>
              {optional && (
                <Link href={optional.href} className="btn btn-outline mt-5">
                  {optional.ctaLabel} →
                </Link>
              )}
            </>
          )}
        </div>
      </div>

      <details className="group mt-6 border-t border-line pt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent [&::-webkit-details-marker]:hidden">
          <span>Ver todo el camino</span>
          <span>
            {requiredDone}/{required.length} esenciales
            <span aria-hidden className="ml-2 transition-transform group-open:rotate-90">→</span>
          </span>
        </summary>
        <ul className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {steps.map((s) => (
            <li key={s.key}>
              <Link href={s.href} className="flex items-start gap-2.5 py-1 hover:text-accent">
                <span className="mt-0.5">
                  <Marker step={s} current={s.key === focus?.key} />
                </span>
                <span className="min-w-0">
                  <span className="font-display text-sm font-bold">{s.title}</span>
                  {!s.required && <span className="ml-2 font-mono text-[9px] tracking-widest text-muted uppercase">Opcional</span>}
                  <span className="block font-mono text-xs text-muted">{s.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
