"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useYMap } from "@/lib/screenplay/use-ymap";
import type { CoachMode } from "@/lib/screenplay-coach";
import { useWorkspace } from "@/components/screenplay/workspace";
import { MARGIN_CARD_MIN, stickyTopBelow, usePaperSpace } from "@/components/screenplay/help-layout";
import { PREF_KEYS, readPref, useCoachMuted, useCoachPref, writePref } from "@/components/screenplay/help-prefs";
import { LineGuideBar, useLineGuideBarVisible } from "@/components/screenplay/LineGuide";
import { NextStepBanner, NextStepCard } from "@/components/screenplay/NextStep";
import { CompanionCard, useCompanionState, useCompanionTriggers } from "@/components/screenplay/AssistantDrawer";

// Las ayudas que acompañan al papel, montadas justo debajo de la barra de
// herramientas: en pantallas anchas, «¿Y ahora qué?» y la tarjeta del
// Compañero en el margen izquierdo (fijas al bajar); en las estrechas, una
// franja encima del papel, la guía de la línea como línea fina bajo la barra
// y el Compañero abajo, encima de la barra del teclado.
export function HelpDock({ onOpenSettings }: { onOpenSettings: () => void }) {
  const ws = useWorkspace();
  const { editor, screenplayId, maps, scenes } = ws;
  const space = usePaperSpace(editor);
  const anchor = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);

  // Pegado justo debajo de la barra de herramientas (va antes en el DOM).
  useLayoutEffect(() => {
    const prev = anchor.current?.previousElementSibling ?? null;
    const measure = () => setTop(stickyTopBelow(prev));
    measure();
    if (!prev) return;
    const ro = new ResizeObserver(measure);
    ro.observe(prev);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // El Compañero: sin elegir, «Me pregunta solo» en guiones que empiezan (o
  // en modo guiado) y «Solo cuando lo pida» en los avanzados. Se fija la
  // primera vez para que no cambie solo al crecer el guion.
  const structure = useYMap<unknown>(maps.structure);
  const fallback: CoachMode = structure.guided === true || scenes.length < 3 ? "auto" : "ask";
  const fallbackRef = useRef(fallback);
  useEffect(() => {
    fallbackRef.current = fallback;
  }, [fallback]);
  useEffect(() => {
    if (!editor) return;
    const t = setTimeout(() => {
      if (readPref(PREF_KEYS.coach(screenplayId)) === null) writePref(PREF_KEYS.coach(screenplayId), fallbackRef.current);
    }, 1500);
    return () => clearTimeout(t);
  }, [editor, screenplayId]);
  const [mode] = useCoachPref(screenplayId, fallback);
  const [muted] = useCoachMuted(screenplayId);
  useCompanionTriggers(mode, muted);
  const companion = useCompanionState();
  const showCard = Boolean(companion.card) && !companion.drawerOpen && mode !== "off";

  const barVisible = useLineGuideBarVisible();
  const wideLeft = space.ready && space.left >= MARGIN_CARD_MIN;
  const width = Math.min(264, space.left - 32);

  return (
    <>
      <div ref={anchor} data-gv2-help-anchor="" className="sticky z-20 h-0" style={{ top }}>
        <LineGuideBar top={0} />
        {wideLeft && (
          <div className="absolute top-5 flex flex-col items-start gap-3" style={{ left: Math.max(8, space.left - width - 24), width }}>
            {showCard && <CompanionCard onOpenSettings={onOpenSettings} />}
            <NextStepCard width={width} folded={showCard} />
          </div>
        )}
      </div>
      {space.ready && !wideLeft && (
        <>
          <NextStepBanner below={barVisible} />
          {showCard && (
            <div className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md md:bottom-36 md:left-auto md:right-5 md:w-[360px]">
              <CompanionCard onOpenSettings={onOpenSettings} compact />
            </div>
          )}
        </>
      )}
    </>
  );
}
