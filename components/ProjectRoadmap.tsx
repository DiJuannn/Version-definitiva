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

function StepMarker({ step, isCurrent }: { step: RoadmapStep; isCurrent: boolean }) {
  if (step.isDone) {
    return (
      <span
        aria-hidden
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-[9px] text-success"
      >
        ✓
      </span>
    );
  }
  if (isCurrent) {
    return (
      <span
        aria-hidden
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-accent"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`h-4 w-4 shrink-0 rounded-full border ${
        step.required ? "border-muted/60" : "border-dashed border-muted/40"
      }`}
    />
  );
}

export function ProjectRoadmap({ steps }: { steps: RoadmapStep[] }) {
  const required = steps.filter((s) => s.required);
  const requiredDone = required.filter((s) => s.isDone).length;
  const doneTotal = steps.filter((s) => s.isDone).length;
  const currentRequired = steps.find((s) => s.required && !s.isDone) ?? null;
  const currentOptional = currentRequired ? null : (steps.find((s) => !s.isDone) ?? null);
  const focusKey = currentRequired?.key ?? currentOptional?.key ?? null;
  const ready = currentRequired === null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mt-6 border border-line bg-bg-raised/30 p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
            Hoja de ruta
          </p>
          <HelpTip text="El camino recomendado para dejar el rodaje listo. Los pasos marcados como opcionales mejoran el proyecto pero no bloquean nada: «listo para rodar» depende solo de los requeridos." />
        </div>
        <p className="font-mono text-[11px] text-muted">
          Requeridos {requiredDone}/{required.length} · Total {doneTotal}/{steps.length}
        </p>
      </div>

      <FeatureIntro featureId="project-roadmap-v2">
        Siempre verás qué toca ahora. Pulsa el botón principal para continuar, o
        cualquier paso de abajo para saltar directo. Los pasos opcionales no
        bloquean nada.
      </FeatureIntro>

      <div className="mt-6 flex items-start gap-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="hidden sm:block"
        >
          <AjoloteLogo className="h-14 w-auto shrink-0" />
        </motion.div>

        {ready ? (
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-bold text-success">Listo para rodar</p>
            <p className="mt-2 font-sans text-sm text-muted">
              Has completado los {required.length} pasos requeridos.
              {currentOptional
                ? " Aún puedes mejorar el proyecto con un paso opcional:"
                : " Y también todos los opcionales."}
            </p>
            {currentOptional && (
              <Link href={currentOptional.href} className="btn btn-outline mt-4">
                {currentOptional.title} →
              </Link>
            )}
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] tracking-widest text-muted uppercase">
              Siguiente paso · {requiredDone + 1} de {required.length} requeridos
            </p>
            <p className="mt-1 font-display text-xl font-bold">{currentRequired.title}</p>
            <p className="mt-2 font-sans text-sm text-muted">{currentRequired.instruction}</p>
            <p className="mt-1 font-mono text-xs text-muted">{currentRequired.detail}</p>
            <Link href={currentRequired.href} className="btn btn-primary mt-4">
              {currentRequired.ctaLabel} →
            </Link>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-6 border-t border-line pt-6 md:grid-cols-3">
        {PHASE_ORDER.map((phase) => {
          const phaseSteps = steps.filter((s) => s.phase === phase);
          const done = phaseSteps.filter((s) => s.isDone).length;
          return (
            <div key={phase}>
              <div className="flex items-center justify-between">
                <p className="font-mono text-[11px] tracking-widest text-fg uppercase">
                  {PHASE_LABELS[phase]}
                </p>
                <p className="font-mono text-[11px] text-muted">
                  {done}/{phaseSteps.length}
                </p>
              </div>
              <div className="mt-2 flex gap-1">
                {phaseSteps.map((step) => (
                  <span
                    key={step.key}
                    className={`h-1 flex-1 rounded-full ${step.isDone ? "bg-success" : "bg-line"}`}
                  />
                ))}
              </div>
              <ul className="mt-3 space-y-1">
                {phaseSteps.map((step) => (
                  <li key={step.key}>
                    <Link
                      href={step.href}
                      className={`group flex items-start gap-2.5 border-l-2 py-2 pr-2 pl-2.5 transition-colors hover:bg-accent/5 ${
                        step.key === focusKey ? "border-accent" : "border-transparent"
                      }`}
                    >
                      <span className="mt-0.5">
                        <StepMarker step={step} isCurrent={step.key === focusKey} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`flex items-center gap-2 font-mono text-xs ${
                            step.isDone ? "text-muted" : "text-fg"
                          }`}
                        >
                          {step.title}
                          {!step.required && (
                            <span className="border border-line px-1.5 py-px text-[9px] tracking-widest text-muted uppercase">
                              Opcional
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-muted">
                          {step.detail}
                        </span>
                      </span>
                      <span
                        aria-hidden
                        className="mt-0.5 font-mono text-xs text-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                      >
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
