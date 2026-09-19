"use client";

import { useMemo, useState } from "react";

export type PlannerShot = {
  id: string;
  label: string;
  size: string | null;
  description: string | null;
  // Día en el que está planificado ahora mismo (null = sin planificar).
  currentDayId: string | null;
  // Nombre corto de ese día cuando NO es el que se está editando.
  otherDayLabel: string | null;
  done: boolean;
};

export type PlannerScene = {
  id: string;
  number: string;
  context: string;
  callTime: string;
  order: string;
  assigned: boolean;
  shots: PlannerShot[];
};

const FIELD =
  "border border-line bg-transparent px-2 py-1 text-xs outline-none transition-colors focus:border-accent";

// Planificador de un día de rodaje: se planifica por escenas y, dentro de cada
// escena, por planos (que es como se rueda de verdad: una escena puede tener
// muchos planos y repartirse en varios días). Todo son campos normales del
// formulario del día — este componente solo mantiene coherentes las casillas.
export function DayPlanner({ dayId, scenes }: { dayId: string; scenes: PlannerScene[] }) {
  const [sceneOn, setSceneOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(scenes.map((s) => [s.id, s.assigned])),
  );
  const [shotOn, setShotOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      scenes.flatMap((s) => s.shots.map((sh) => [sh.id, sh.currentDayId === dayId] as const)),
    ),
  );
  const [shotDone, setShotDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(scenes.flatMap((s) => s.shots.map((sh) => [sh.id, sh.done] as const))),
  );
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(scenes.map((s) => [s.id, s.shots.some((sh) => sh.currentDayId === dayId)])),
  );

  const totals = useMemo(() => {
    const sceneCount = scenes.filter((s) => sceneOn[s.id]).length;
    const shotCount = scenes.reduce((n, s) => n + s.shots.filter((sh) => shotOn[sh.id]).length, 0);
    return { sceneCount, shotCount };
  }, [scenes, sceneOn, shotOn]);

  function toggleScene(scene: PlannerScene, value: boolean) {
    setSceneOn((prev) => ({ ...prev, [scene.id]: value }));
    if (scene.shots.length === 0) return;
    setShotOn((prev) => {
      const next = { ...prev };
      for (const sh of scene.shots) {
        // Al marcar la escena entran los planos libres o de este día; los que ya
        // están en otro día se quedan donde están (se marcan a mano si se quieren mover).
        next[sh.id] = value ? sh.currentDayId === null || sh.currentDayId === dayId : false;
      }
      return next;
    });
    if (value) setOpen((prev) => ({ ...prev, [scene.id]: true }));
    else
      setShotDone((prev) => {
        const next = { ...prev };
        for (const sh of scene.shots) next[sh.id] = false;
        return next;
      });
  }

  function toggleShot(scene: PlannerScene, shot: PlannerShot, value: boolean) {
    const nextShots = { ...shotOn, [shot.id]: value };
    setShotOn(nextShots);
    setSceneOn((prev) => ({ ...prev, [scene.id]: scene.shots.some((sh) => nextShots[sh.id]) }));
    if (!value) setShotDone((prev) => ({ ...prev, [shot.id]: false }));
  }

  return (
    <div className="mt-4">
      <input type="hidden" name="planner" value="1" />

      <p className="font-mono text-[11px] text-muted">
        Hoy: <span className="text-fg">{totals.sceneCount}</span> escena{totals.sceneCount === 1 ? "" : "s"} ·{" "}
        <span className="text-fg">{totals.shotCount}</span> plano{totals.shotCount === 1 ? "" : "s"}
      </p>

      <div className="mt-3 border-t border-line">
        <div
          aria-hidden
          className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-line py-2 font-mono text-[10px] tracking-widest text-muted uppercase"
        >
          <span className="w-4" />
          <span>Escena</span>
          <span className="w-24">Hora de llamada</span>
          <span className="w-20">Orden</span>
        </div>

        {scenes.map((scene) => {
          const on = Boolean(sceneOn[scene.id]);
          const todayShots = scene.shots.filter((sh) => shotOn[sh.id]).length;
          const isOpen = Boolean(open[scene.id]);
          return (
            <div key={scene.id} className="border-b border-line">
              <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 py-3">
                <input
                  type="checkbox"
                  name={`assign_${scene.id}`}
                  checked={on}
                  onChange={(e) => toggleScene(scene, e.target.checked)}
                  aria-label={`Incluir la escena ${scene.number} en este día`}
                />
                <div className="min-w-0">
                  <span className="font-mono text-sm">Escena {scene.number}</span>
                  <span className="ml-2 font-mono text-xs text-muted">{scene.context}</span>
                  {scene.shots.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setOpen((prev) => ({ ...prev, [scene.id]: !isOpen }))}
                      aria-expanded={isOpen}
                      className="ml-3 inline-flex items-center gap-1 font-mono text-[11px] text-accent hover:underline"
                    >
                      {todayShots} de {scene.shots.length} plano{scene.shots.length === 1 ? "" : "s"} hoy
                      <span aria-hidden>{isOpen ? "▴" : "▾"}</span>
                    </button>
                  )}
                </div>
                <input
                  name={`callTime_${scene.id}`}
                  aria-label={`Hora de llamada de la escena ${scene.number}`}
                  placeholder="08:30"
                  defaultValue={scene.callTime}
                  className={`${FIELD} w-24`}
                />
                <input
                  name={`order_${scene.id}`}
                  type="number"
                  aria-label={`Orden de la escena ${scene.number}`}
                  placeholder="1"
                  defaultValue={scene.order}
                  className={`${FIELD} w-20`}
                />
              </div>

              {/* Siempre en el DOM (oculto si está plegado) para que sus casillas se envíen igualmente. */}
              {scene.shots.length > 0 && (
                <ul className={isOpen ? "mb-3 ml-7 space-y-px border-l border-line pl-4" : "hidden"}>
                  {scene.shots.map((shot) => {
                    const checked = Boolean(shotOn[shot.id]);
                    return (
                      <li
                        key={shot.id}
                        className="grid grid-cols-[auto_3.2rem_2.6rem_1fr_auto] items-center gap-3 py-1.5"
                      >
                        <input
                          type="checkbox"
                          name={`shot_${shot.id}`}
                          checked={checked}
                          onChange={(e) => toggleShot(scene, shot, e.target.checked)}
                          aria-label={`Rodar el plano ${shot.label} este día`}
                        />
                        <span className="font-mono text-xs text-accent">{shot.label}</span>
                        <span className="font-mono text-xs uppercase">{shot.size ?? "—"}</span>
                        <span className="min-w-0 truncate font-mono text-xs text-muted">
                          {shot.description ?? ""}
                          {shot.otherDayLabel && !checked && (
                            <span className="ml-2 border border-line px-1.5 py-0.5 text-[10px] text-muted">
                              ya en {shot.otherDayLabel}
                            </span>
                          )}
                        </span>
                        {checked ? (
                          <label className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
                            <input
                              type="checkbox"
                              name={`done_${shot.id}`}
                              checked={Boolean(shotDone[shot.id])}
                              onChange={(e) => setShotDone((prev) => ({ ...prev, [shot.id]: e.target.checked }))}
                            />
                            Rodado
                          </label>
                        ) : (
                          <span />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 font-mono text-[11px] text-muted">
        Marca la escena para rodarla entera o abre sus planos y elige solo los de hoy. Un plano que ya está en
        otro día se mueve aquí si lo marcas.
      </p>
    </div>
  );
}
