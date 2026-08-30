"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { AjoloteLogo } from "@/components/AjoloteLogo";
import { HelpTip } from "@/components/HelpTip";
import { FeatureIntro } from "@/components/FeatureIntro";
import type { RoadmapPhase, RoadmapStep } from "@/lib/project-roadmap";

const PHASE_LABELS: Record<RoadmapPhase, string> = {
  base: "Base del proyecto",
  tecnica: "Preparación técnica",
  rodaje: "Listos para rodar",
};

const PHASE_ORDER: RoadmapPhase[] = ["base", "tecnica", "rodaje"];

function PhaseCard({
  phase,
  steps,
  isCurrentPhase,
}: {
  phase: RoadmapPhase;
  steps: RoadmapStep[];
  isCurrentPhase: boolean;
}) {
  const done = steps.filter((s) => s.isDone).length;
  const total = steps.length;
  const allDone = done === total;

  return (
    <details
      open={isCurrentPhase}
      className={
        "group border p-4 transition-colors " +
        (isCurrentPhase ? "border-accent" : "border-line hover:border-muted")
      }
    >
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between">
          <span
            className={
              "flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase " +
              (isCurrentPhase ? "text-accent" : "text-fg")
            }
          >
            {PHASE_LABELS[phase]}
            {allDone && <span className="text-accent">✓</span>}
          </span>
          <span className="text-muted transition-transform group-open:rotate-90">
            →
          </span>
        </div>
        <div className="mt-3 flex gap-1">
          {steps.map((step) => (
            <span
              key={step.key}
              className={
                "h-1.5 flex-1 rounded-full " + (step.isDone ? "bg-accent" : "bg-line")
              }
            />
          ))}
        </div>
        <p className="mt-2 font-mono text-[10px] text-muted">
          {done}/{total} completado{done === 1 ? "" : "s"}
        </p>
      </summary>

      <div className="mt-4 space-y-3 border-t border-line pt-4">
        {steps.map((step) => (
          <div key={step.key} className="flex items-start justify-between gap-3">
            <div>
              <p
                className={
                  "font-mono text-xs " + (step.isDone ? "text-muted" : "text-fg")
                }
              >
                {step.isDone ? "✓ " : ""}
                {step.title}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-muted">{step.detail}</p>
            </div>
            {!step.isDone && (
              <Link
                href={step.href}
                className="shrink-0 font-mono text-[10px] tracking-widest text-accent uppercase hover:opacity-80"
              >
                {step.ctaLabel} →
              </Link>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

export function ProjectRoadmap({ steps }: { steps: RoadmapStep[] }) {
  const currentIndex = steps.findIndex((s) => !s.isDone);
  const allDone = currentIndex === -1;
  const current = allDone ? null : steps[currentIndex];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mt-8 border border-line p-6"
    >
      <div className="flex items-center gap-1.5">
        <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
          Hoja de ruta
        </p>
        <HelpTip text="El camino recomendado para dejar el rodaje listo, paso a paso. Se actualiza sola según vayas completando cada parte — no hace falta seguir el orden a rajatabla, es solo una guía." />
      </div>

      <FeatureIntro featureId="project-roadmap">
        Te guiamos paso a paso: siempre verás qué toca hacer ahora. Pulsa el
        botón grande para continuar, o cualquier punto de abajo para saltar
        directo a esa parte.
      </FeatureIntro>

      <div className="mt-6 flex items-start gap-4">
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          className="hidden sm:block"
        >
          <AjoloteLogo className="h-14 w-auto shrink-0" />
        </motion.div>

        {allDone ? (
          <div>
            <p className="font-display text-xl font-bold uppercase">
              Todo listo para rodar
            </p>
            <p className="mt-2 font-sans text-sm text-muted">
              Has completado los pasos clave de preproducción. Revisa los
              detalles cuando quieras desde el mapa de abajo.
            </p>
          </div>
        ) : (
          <div className="flex-1">
            <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
              Paso {currentIndex + 1} de {steps.length}
            </p>
            <p className="mt-1 font-display text-xl font-bold uppercase">
              {current!.title}
            </p>
            <p className="mt-2 font-sans text-sm text-muted">
              {current!.instruction}
            </p>
            <p className="mt-1 font-mono text-xs text-muted">{current!.detail}</p>
            <Link
              href={current!.href}
              className="mt-4 inline-block rounded-full bg-accent px-6 py-2.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
            >
              {current!.ctaLabel} →
            </Link>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-3 border-t border-line pt-6 sm:grid-cols-3">
        {PHASE_ORDER.map((phase) => {
          const phaseSteps = steps.filter((s) => s.phase === phase);
          const isCurrentPhase = current ? current.phase === phase : false;
          return (
            <PhaseCard
              key={phase}
              phase={phase}
              steps={phaseSteps}
              isCurrentPhase={isCurrentPhase}
            />
          );
        })}
      </div>
    </motion.section>
  );
}
