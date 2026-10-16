"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { phaseOfSegment, type PhaseId } from "@/lib/project-phases";

// Pone la gelatina de la fase en la que se está (la de la herramienta abierta,
// o la del proyecto en la portada): botones principales, acentos y luz de la
// mesa toman su color. Cambiar de fase «cambia la gelatina».
export function PhaseScope({ stage, children }: { stage: PhaseId; children: ReactNode }) {
  const segment = usePathname().split("/")[3];
  const phase = phaseOfSegment(segment) ?? stage;
  return (
    <div data-phase={phase} className="phase-scope">
      {children}
    </div>
  );
}
