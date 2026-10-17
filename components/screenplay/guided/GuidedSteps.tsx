"use client";

import type { Step } from "@/components/screenplay/workspace";
import { GuidedStart } from "@/components/screenplay/guided/GuidedStart";
import { SkeletonStep } from "@/components/screenplay/guided/SkeletonStep";

// Los dos pasos del camino guiado antes de escribir: Empezar y Esqueleto.
export function GuidedSteps({ step, format, title }: { step: Step; format: string; title: string }) {
  if (step === "empezar")
    return (
      <div key="empezar" className="sp-enter">
        <GuidedStart format={format} />
      </div>
    );
  if (step === "esqueleto")
    return (
      <div key="esqueleto" className="sp-enter">
        <SkeletonStep format={format} title={title} />
      </div>
    );
  return null;
}
