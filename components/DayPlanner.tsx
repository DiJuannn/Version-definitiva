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

const FIELD = "field px-2 py-1.5 text-center font-mono text-xs";

// Planificador de un día de rodaje: se planifica por escenas y, dentro de cada
// escena, por planos (que es como se rueda de verdad: una escena puede tener
// muchos planos y repartirse en varios días). Todo son campos normales del
// formulario del día — este componente solo mantiene coherentes las casillas.
export function DayPlanner({
  dayId,
  scenes,
}: {
  dayId: string;
  scenes: PlannerScene[];
}) {
  const [sceneOn, setSceneOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(scenes.map((s) => [s.id, s.assigned])),
  );
  const [shotOn, setShotOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      scenes.flatMap((s) =>
        s.shots.map((sh) => [sh.id, sh.currentDayId === dayId] as const),
      ),
    ),
  );
  const [shotDone, setShotDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      scenes.flatMap((s) => s.shots.map((sh) => [sh.id, sh.done] as const)),
    ),
  );
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      scenes.map((s) => [
        s.id,
        s.shots.some((sh) => sh.currentDayId === dayId),
      ]),
    ),
  );

  const totals = useMemo(() => {
    const sceneCount = scenes.filter((s) => sceneOn[s.id]).length;
    const shotCount = scenes.reduce(
      (n, s) => n + s.shots.filter((sh) => shotOn[sh.id]).length,
      0,
    );
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
        next[sh.id] = value
          ? sh.currentDayId === null || sh.currentDayId === dayId
          : false;
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
    setSceneOn((prev) => ({
      ...prev,
      [scene.id]: scene.shots.some((sh) => nextShots[sh.id]),
    }));
    if (!value) setShotDone((prev) => ({ ...prev, [shot.id]: false }));
  }

  return (
    <div>
      <input type="hidden" name="planner" value="1" />

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="font-sans text-[15px]">
          Este día se ruedan{" "}
          <strong className="font-semibold">{totals.sceneCount}</strong> escena
          {totals.sceneCount === 1 ? "" : "s"} y{" "}
          <strong className="font-semibold">{totals.shotCount}</strong> plano
          {totals.shotCount === 1 ? "" : "s"}.
        </p>
        <p className="font-sans text-sm text-muted">
          Marca una escena para rodarla entera, o abre sus planos.
        </p>
      </div>

      <div className="mt-5">
        <div
          aria-hidden
          className="grid grid-cols-[auto_1fr_4.5rem_3.5rem] items-center gap-3 border-b border-line pb-2 sm:grid-cols-[auto_1fr_6rem_4.5rem]"
        >
          <span className="w-4" />
          <span className="eyebrow">Escena</span>
          <span className="eyebrow text-center">Llamada</span>
          <span className="eyebrow text-center">Orden</span>
        </div>

        {scenes.map((scene) => {
          const on = Boolean(sceneOn[scene.id]);
          const todayShots = scene.shots.filter((sh) => shotOn[sh.id]).length;
          const isOpen = Boolean(open[scene.id]);
          return (
            <div key={scene.id} className="border-b border-line">
              <div className="grid grid-cols-[auto_1fr_4.5rem_3.5rem] items-center gap-3 py-3.5 sm:grid-cols-[auto_1fr_6rem_4.5rem]">
                <input
                  type="checkbox"
                  name={`assign_${scene.id}`}
                  checked={on}
                  onChange={(e) => toggleScene(scene, e.target.checked)}
                  aria-label={`Incluir la escena ${scene.number} en este día`}
                  className="h-4 w-4"
                />
                <div className="min-w-0">
                  <p
                    className={`font-display text-base font-bold ${on ? "" : "text-muted"}`}
                  >
                    Escena {scene.number}
                  </p>
                  <p className="font-sans text-[13px] text-muted">
                    {scene.context}
                    {scene.shots.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setOpen((prev) => ({ ...prev, [scene.id]: !isOpen }))
                        }
                        aria-expanded={isOpen}
                        className="ml-3 inline-flex items-center gap-1 font-mono text-[11px] text-accent hover:underline"
                      >
                        {todayShots} de {scene.shots.length} plano
                        {scene.shots.length === 1 ? "" : "s"} hoy
                        <span aria-hidden>{isOpen ? "▴" : "▾"}</span>
                      </button>
                    )}
                  </p>
                </div>
                <input
                  name={`callTime_${scene.id}`}
                  aria-label={`Hora de llamada de la escena ${scene.number}`}
                  placeholder="--:--"
                  defaultValue={scene.callTime}
                  className={`${FIELD} w-full`}
                />
                <input
                  name={`order_${scene.id}`}
                  type="number"
                  aria-label={`Orden de la escena ${scene.number}`}
                  placeholder="—"
                  defaultValue={scene.order}
                  className={`${FIELD} w-full`}
                />
              </div>

              {/* Siempre en el DOM (oculto si está plegado) para que sus casillas se envíen igualmente. */}
              {scene.shots.length > 0 && (
                <ul
                  className={
                    isOpen
                      ? "mb-4 ml-7 border-l-2 border-accent/40 pl-4"
                      : "hidden"
                  }
                >
                  {scene.shots.map((shot) => {
                    const checked = Boolean(shotOn[shot.id]);
                    return (
                      <li
                        key={shot.id}
                        className="grid grid-cols-[auto_3.2rem_2.6rem_1fr_auto] items-center gap-3 py-2"
                      >
                        <input
                          type="checkbox"
                          name={`shot_${shot.id}`}
                          checked={checked}
                          onChange={(e) =>
                            toggleShot(scene, shot, e.target.checked)
                          }
                          aria-label={`Rodar el plano ${shot.label} este día`}
                          className="h-4 w-4"
                        />
                        <span className="font-mono text-xs text-accent">
                          {shot.label}
                        </span>
                        <span className="font-mono text-xs uppercase">
                          {shot.size ?? "—"}
                        </span>
                        <span className="min-w-0 truncate font-sans text-[13px] text-muted">
                          {shot.description ?? ""}
                          {shot.otherDayLabel && !checked && (
                            <span className="ml-2 font-mono text-[11px] text-warn">
                              · ya en {shot.otherDayLabel}
                            </span>
                          )}
                        </span>
                        {checked ? (
                          <label className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
                            <input
                              type="checkbox"
                              name={`done_${shot.id}`}
                              checked={Boolean(shotDone[shot.id])}
                              onChange={(e) =>
                                setShotDone((prev) => ({
                                  ...prev,
                                  [shot.id]: e.target.checked,
                                }))
                              }
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

      <p className="mt-4 font-sans text-sm text-muted">
        Un plano que ya está en otro día se mueve a este si lo marcas.
      </p>
    </div>
  );
}
