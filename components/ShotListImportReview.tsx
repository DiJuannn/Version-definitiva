"use client";

import { useMemo, useState, useTransition } from "react";
import { importReviewedShotList, discardShotListImport } from "@/lib/actions/shot-list-import";
import { useToast } from "@/components/Toast";

type ProposedShot = {
  number: string;
  shotType?: string;
  shotSize?: string;
  angle?: string;
  movement?: string;
  camera?: string;
  lens?: string;
  description?: string;
  audio?: string;
  notes?: string;
};
type ProposedScene = { number: string; shots: ProposedShot[] };
type Proposal = { scenes: ProposedScene[] };

type ShotRow = ProposedShot & { key: string; on: boolean };
type SceneRow = { key: string; number: string; shots: ShotRow[] };

// Campos subrayados: se edita dentro de la fila, sin cajas.
const inputClass = "field-line mt-0 py-1 text-sm";
const COLS =
  "sm:grid-cols-[1.25rem_3.5rem_5rem_7rem_7rem_minmax(0,1fr)_auto]";
const nextKey = () => `r${Math.random().toString(36).slice(2, 10)}`;

function initialState(proposal: Proposal): SceneRow[] {
  return proposal.scenes.map((scene) => ({
    key: nextKey(),
    number: scene.number,
    shots: scene.shots.map((shot) => ({ ...shot, key: nextKey(), on: true })),
  }));
}

export function ShotListImportReview({
  projectId,
  importId,
  proposal,
  existingShotsByScene,
}: {
  projectId: string;
  importId: string;
  proposal: Proposal;
  existingShotsByScene: Record<string, string[]>;
}) {
  const [scenes, setScenes] = useState<SceneRow[]>(() => initialState(proposal));
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const existingSceneNumbers = useMemo(() => Object.keys(existingShotsByScene), [existingShotsByScene]);
  const existingSceneSet = useMemo(() => new Set(existingSceneNumbers), [existingSceneNumbers]);

  // El guion técnico debe numerar las escenas igual que el guion narrativo — si ninguna
  // escena propuesta coincide con una existente (y el proyecto ya tiene escenas), lo más
  // probable es que la numeración no case, no que sean escenas nuevas de verdad.
  const matchedSceneCount = useMemo(
    () => scenes.filter((s) => existingSceneSet.has(s.number.trim())).length,
    [scenes, existingSceneSet],
  );
  const possibleNumberingMismatch = existingSceneNumbers.length > 0 && matchedSceneCount === 0;

  const totals = useMemo(() => {
    let on = 0;
    let updating = 0;
    for (const scene of scenes) {
      const existingShots = new Set(existingShotsByScene[scene.number.trim()] ?? []);
      for (const shot of scene.shots) {
        if (!shot.on || !shot.number.trim()) continue;
        on++;
        if (existingShots.has(shot.number)) updating++;
      }
    }
    return { on, updating, creating: on - updating };
  }, [scenes, existingShotsByScene]);

  function updateScene(sceneKey: string, patch: Partial<SceneRow>) {
    setScenes((prev) => prev.map((scene) => (scene.key !== sceneKey ? scene : { ...scene, ...patch })));
  }

  function updateShot(sceneKey: string, shotKey: string, patch: Partial<ShotRow>) {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.key !== sceneKey
          ? scene
          : { ...scene, shots: scene.shots.map((s) => (s.key === shotKey ? { ...s, ...patch } : s)) },
      ),
    );
  }

  function removeShot(sceneKey: string, shotKey: string) {
    setScenes((prev) =>
      prev.map((scene) =>
        scene.key !== sceneKey ? scene : { ...scene, shots: scene.shots.filter((s) => s.key !== shotKey) },
      ),
    );
  }

  function toggleScene(sceneKey: string, on: boolean) {
    setScenes((prev) =>
      prev.map((scene) => (scene.key !== sceneKey ? scene : { ...scene, shots: scene.shots.map((s) => ({ ...s, on })) })),
    );
  }

  function submit() {
    const payload: Proposal = {
      scenes: scenes
        .map((scene) => ({
          number: scene.number.trim(),
          shots: scene.shots
            .filter((s) => s.on && s.number.trim())
            .map((s) => ({
              number: s.number,
              shotType: s.shotType || undefined,
              shotSize: s.shotSize || undefined,
              angle: s.angle || undefined,
              movement: s.movement || undefined,
              camera: s.camera || undefined,
              lens: s.lens || undefined,
              description: s.description || undefined,
              audio: s.audio || undefined,
              notes: s.notes || undefined,
            })),
        }))
        .filter((s) => s.shots.length > 0),
    };

    startTransition(async () => {
      const result = await importReviewedShotList(projectId, importId, payload);
      if (result?.error) toast("error", result.error);
    });
  }

  function discard() {
    startTransition(async () => {
      await discardShotListImport(projectId, importId);
    });
  }

  if (scenes.length === 0) {
    return (
      <div className="mt-12 py-10 text-center">
        <p className="font-display text-lg font-bold">No se han encontrado planos</p>
        <p className="mx-auto mt-2 max-w-md font-sans text-sm text-muted">
          La IA no ha reconocido planos en el documento. Descártalo y prueba con otro archivo.
        </p>
        <button onClick={discard} disabled={pending} className="btn btn-secondary mt-5">
          Descartar
        </button>
      </div>
    );
  }

  return (
    <div className="mt-10">
      {possibleNumberingMismatch && (
        <div className="mb-8 max-w-3xl border-l-2 border-warn pl-4">
          <p className="font-sans text-[15px] font-semibold text-warn">Revisa la numeración de las escenas</p>
          <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
            Ninguna escena de este guion técnico coincide con las {existingSceneNumbers.length} escenas que ya tiene
            el proyecto. Para que los planos se enganchen a la escena correcta, corrige el número de cada escena
            abajo (al escribir verás los números que ya existen). Si no, se crearán escenas nuevas y vacías en vez de
            rellenar las tuyas.
          </p>
        </div>
      )}

      <datalist id="escenas-existentes">
        {existingSceneNumbers.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="sheet overflow-hidden">
        <div
          aria-hidden
          className={`hidden gap-x-4 border-b border-line px-5 py-3 font-mono text-[10px] tracking-widest text-muted uppercase sm:grid sm:px-7 ${COLS}`}
        >
          <span />
          <span>Plano</span>
          <span>Tamaño</span>
          <span>Ángulo</span>
          <span>Movimiento</span>
          <span>Descripción</span>
          <span />
        </div>

        {scenes.map((scene) => {
          const trimmedNumber = scene.number.trim();
          const isExisting = existingSceneSet.has(trimmedNumber);
          const existingShots = new Set(existingShotsByScene[trimmedNumber] ?? []);
          const allOn = scene.shots.every((s) => s.on);
          return (
            <section key={scene.key} className="border-t border-line [&:nth-child(2)]:border-t-0">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-6 pb-2 sm:px-7">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <label className="flex items-baseline gap-2">
                    <span className="font-display text-lg font-bold">Escena</span>
                    {/* .field-line ocupa todo el ancho: el span le pone límite. */}
                    <span className="block w-16">
                      <input
                        value={scene.number}
                        onChange={(e) => updateScene(scene.key, { number: e.target.value })}
                        list="escenas-existentes"
                        aria-label="Número de escena"
                        className="field-line py-0.5 font-display text-lg font-bold"
                      />
                    </span>
                  </label>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase ${
                      isExisting ? "bg-fg/[0.06] text-muted" : "bg-warn/10 text-warn"
                    }`}
                  >
                    {isExisting ? "Ya existe" : "Se creará nueva"}
                  </span>
                </div>
                <label className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-muted uppercase">
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={(e) => toggleScene(scene.key, e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  Todos
                </label>
              </div>

              <ul className="divide-y divide-line">
                {scene.shots.map((shot) => {
                  const updating = existingShots.has(shot.number);
                  const label = `plano ${scene.number}.${shot.number}`;
                  return (
                    <li key={shot.key} className={`px-5 py-3 sm:px-7 ${shot.on ? "" : "opacity-50"}`}>
                      <div className={`grid grid-cols-[1.25rem_3rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-4 gap-y-2 ${COLS}`}>
                        <input
                          type="checkbox"
                          checked={shot.on}
                          onChange={(e) => updateShot(scene.key, shot.key, { on: e.target.checked })}
                          aria-label={`Importar ${label}`}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                        <input
                          value={shot.number}
                          onChange={(e) => updateShot(scene.key, shot.key, { number: e.target.value })}
                          className={`${inputClass} font-mono text-accent`}
                          placeholder="Nº"
                          aria-label="Número de plano"
                        />
                        <input
                          value={shot.shotSize ?? ""}
                          onChange={(e) => updateShot(scene.key, shot.key, { shotSize: e.target.value })}
                          className={`${inputClass} font-mono uppercase`}
                          placeholder="Tamaño"
                          aria-label={`Tamaño del ${label}`}
                        />
                        <input
                          value={shot.angle ?? ""}
                          onChange={(e) => updateShot(scene.key, shot.key, { angle: e.target.value })}
                          className={`${inputClass} col-start-3 sm:col-start-auto`}
                          placeholder="Ángulo"
                          aria-label={`Ángulo del ${label}`}
                        />
                        <input
                          value={shot.movement ?? ""}
                          onChange={(e) => updateShot(scene.key, shot.key, { movement: e.target.value })}
                          className={`${inputClass} col-start-4 sm:col-start-auto`}
                          placeholder="Movimiento"
                          aria-label={`Movimiento del ${label}`}
                        />
                        <input
                          value={shot.description ?? ""}
                          onChange={(e) => updateShot(scene.key, shot.key, { description: e.target.value })}
                          className={`${inputClass} col-span-3 col-start-2 sm:col-span-1 sm:col-start-auto`}
                          placeholder="Descripción"
                          aria-label={`Descripción del ${label}`}
                        />
                        <span className="col-start-4 row-start-1 flex items-center justify-end gap-3 sm:col-start-auto sm:row-start-auto">
                          {updating && (
                            <span className="rounded-full bg-warn/10 px-2 py-0.5 font-mono text-[10px] tracking-wide text-warn uppercase">
                              Actualiza
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeShot(scene.key, shot.key)}
                            aria-label={`Quitar ${label}`}
                            className="link-action hover:text-danger"
                          >
                            Quitar
                          </button>
                        </span>
                      </div>

                      {(shot.shotType || shot.camera || shot.lens || shot.audio || shot.notes) && (
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 pl-9 sm:grid-cols-[8rem_5rem_6rem_9rem_minmax(0,1fr)] sm:pl-[5.75rem]">
                          {(
                            [
                              ["shotType", "Tipo de plano"],
                              ["camera", "Cámara"],
                              ["lens", "Lente"],
                              ["audio", "Audio"],
                              ["notes", "Notas"],
                            ] as const
                          ).map(([key, placeholder]) => (
                            <input
                              key={key}
                              value={shot[key] ?? ""}
                              onChange={(e) => updateShot(scene.key, shot.key, { [key]: e.target.value })}
                              className={`${inputClass} text-[13px] text-muted`}
                              placeholder={placeholder}
                              aria-label={`${placeholder} del ${label}`}
                            />
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Barra de importación: lo que se va a añadir, siempre a la vista. */}
      <div className="sheet sticky bottom-24 z-20 mt-8 flex flex-wrap items-center justify-between gap-4 bg-bg-raised/95 px-4 py-3 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.6)] backdrop-blur-md sm:bottom-4 sm:px-6 sm:py-4">
        <p className="font-sans text-sm">
          {totals.on === 0 ? (
            "Ningún plano marcado."
          ) : (
            <>
              {totals.on} plano{totals.on === 1 ? "" : "s"} marcado{totals.on === 1 ? "" : "s"}
              <span className="text-muted">
                {totals.creating > 0 && ` · ${totals.creating} nuevo${totals.creating === 1 ? "" : "s"}`}
                {totals.updating > 0 &&
                  ` · ${totals.updating} actualizará${totals.updating === 1 ? "" : "n"} uno existente`}
              </span>
            </>
          )}
        </p>
        <div className="flex items-center gap-4">
          <button onClick={discard} disabled={pending} className="link-action hover:text-danger">
            Descartar
          </button>
          <button onClick={submit} disabled={pending || totals.on === 0} className="btn btn-primary">
            {pending ? "Importando…" : `Añadir ${totals.on} plano${totals.on === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
