"use client";

import type { CoachMode } from "@/lib/screenplay-coach";
import { useCoachMuted, useCoachPref, useLineGuidePref, useNextStepPref, type LineGuidePref } from "@/components/screenplay/help-prefs";
import { CoachModePicker } from "@/components/screenplay/AssistantDrawer";

// Sección «Ayudas» de Ajustes del guion. Son preferencias tuyas (se guardan
// en este navegador): no cambian nada para quien escribe contigo.
export function HelpSettings({ screenplayId }: { screenplayId: string }) {
  const [guide, setGuide] = useLineGuidePref();
  const [next, setNext] = useNextStepPref();
  // Si aún no se ha elegido, el editor ya ha fijado uno al abrir el guion.
  const [coach, setCoach] = useCoachPref(screenplayId, "ask" satisfies CoachMode);
  const [muted, setMuted] = useCoachMuted(screenplayId);
  const GUIDE: { id: LineGuidePref; label: string }[] = [
    { id: "auto", label: "Mientras el guion es corto" },
    { id: "always", label: "Siempre" },
    { id: "off", label: "Nunca" },
  ];
  return (
    <div className="mt-6 border-t border-[var(--line)] pt-5">
      <h3 className="text-[14px] font-bold">Ayudas</h3>
      <p className="mt-0.5 text-[12.5px] leading-snug text-muted">Solo para ti, en este navegador: no cambian nada para quien escribe contigo.</p>

      <div className="mt-4 space-y-4 text-[13px]">
        <div>
          <p className="font-medium">Guía de la línea</p>
          <p className="text-[12.5px] leading-snug text-muted">Al lado de la línea donde escribes: qué es y qué hacen Enter y Tab.</p>
          <div role="radiogroup" aria-label="Guía de la línea" className="mt-1.5 inline-flex overflow-hidden rounded-md border border-[var(--line)] bg-white">
            {GUIDE.map((g, i) => (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={guide === g.id}
                onClick={() => setGuide(g.id)}
                className={`px-2.5 py-1 text-[12.5px] ${i ? "border-l border-[var(--line)]" : ""} ${guide === g.id ? "bg-[#1c1b19] text-white" : "text-muted hover:text-fg"}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input type="checkbox" checked={next === "on"} onChange={(e) => setNext(e.target.checked ? "on" : "off")} className="mt-0.5 accent-[var(--accent)]" />
          <span>
            <span className="block font-medium">«¿Y ahora qué?»</span>
            <span className="block text-[12.5px] leading-snug text-muted">Una tarjeta junto al papel con lo siguiente que puedes hacer.</span>
          </span>
        </label>

        <div>
          <p className="font-medium">El Compañero IA</p>
          <p className="text-[12.5px] leading-snug text-muted">Solo pregunta, nunca escribe en tu guion.</p>
          <div className="mt-1.5 -ml-2">
            <CoachModePicker mode={coach} onChange={setCoach} name="coach-mode-settings" />
          </div>
          {muted && (
            <button type="button" onClick={() => setMuted(false)} className="mt-1 text-[12.5px] text-[var(--accent)] hover:underline">
              Está silenciado en esta sesión · volver a activarlo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
