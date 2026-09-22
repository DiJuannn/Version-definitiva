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
type SceneRow = { key: string; number: string; existing: boolean; shots: ShotRow[] };

const inputClass =
  "border border-line bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-accent";
const nextKey = () => `r${Math.random().toString(36).slice(2, 10)}`;

function initialState(proposal: Proposal, existingShotsByScene: Record<string, string[]>): SceneRow[] {
  return proposal.scenes.map((scene) => ({
    key: nextKey(),
    number: scene.number,
    existing: scene.number in existingShotsByScene,
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
  const [scenes, setScenes] = useState<SceneRow[]>(() => initialState(proposal, existingShotsByScene));
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const totals = useMemo(() => {
    let on = 0;
    let updating = 0;
    for (const scene of scenes) {
      const existingShots = new Set(existingShotsByScene[scene.number] ?? []);
      for (const shot of scene.shots) {
        if (!shot.on || !shot.number.trim()) continue;
        on++;
        if (existingShots.has(shot.number)) updating++;
      }
    }
    return { on, updating, creating: on - updating };
  }, [scenes, existingShotsByScene]);

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
          number: scene.number,
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
      <div className="mt-8 border border-line p-6">
        <p className="text-sm text-muted">
          La IA no encontró planos reconocibles en el documento. Puedes descartarlo y probar con otro archivo.
        </p>
        <button onClick={discard} disabled={pending} className="btn btn-secondary mt-4">
          Descartar
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-5">
      <p className="font-mono text-xs text-muted">
        {totals.on} plano{totals.on === 1 ? "" : "s"} seleccionado{totals.on === 1 ? "" : "s"}
        {totals.creating > 0 && ` · ${totals.creating} nuevo${totals.creating === 1 ? "" : "s"}`}
        {totals.updating > 0 && ` · ${totals.updating} actualizará${totals.updating === 1 ? "" : "n"} uno existente`}
      </p>

      {scenes.map((scene) => {
        const existingShots = new Set(existingShotsByScene[scene.number] ?? []);
        const allOn = scene.shots.every((s) => s.on);
        return (
          <section key={scene.key} className="border border-line bg-bg-raised/40">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
              <h2 className="font-display text-base font-bold">
                Escena {scene.number}{" "}
                <span className="font-mono text-[10px] font-normal tracking-widest text-muted uppercase">
                  {scene.existing ? "(existe)" : "(se creará)"}
                </span>
              </h2>
              <label className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted uppercase">
                <input type="checkbox" checked={allOn} onChange={(e) => toggleScene(scene.key, e.target.checked)} />
                Todos
              </label>
            </div>

            <div className="divide-y divide-line">
              {scene.shots.map((shot) => {
                const updating = existingShots.has(shot.number);
                return (
                  <div key={shot.key} className={`px-5 py-3 ${shot.on ? "" : "opacity-40"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="checkbox"
                        checked={shot.on}
                        onChange={(e) => updateShot(scene.key, shot.key, { on: e.target.checked })}
                      />
                      <input
                        value={shot.number}
                        onChange={(e) => updateShot(scene.key, shot.key, { number: e.target.value })}
                        className={`${inputClass} w-16 font-mono`}
                        placeholder="Nº"
                      />
                      <input
                        value={shot.shotSize ?? ""}
                        onChange={(e) => updateShot(scene.key, shot.key, { shotSize: e.target.value })}
                        className={`${inputClass} w-24`}
                        placeholder="Tamaño"
                      />
                      <input
                        value={shot.angle ?? ""}
                        onChange={(e) => updateShot(scene.key, shot.key, { angle: e.target.value })}
                        className={`${inputClass} w-28`}
                        placeholder="Ángulo"
                      />
                      <input
                        value={shot.movement ?? ""}
                        onChange={(e) => updateShot(scene.key, shot.key, { movement: e.target.value })}
                        className={`${inputClass} w-28`}
                        placeholder="Movimiento"
                      />
                      <input
                        value={shot.description ?? ""}
                        onChange={(e) => updateShot(scene.key, shot.key, { description: e.target.value })}
                        className={`${inputClass} min-w-56 flex-1`}
                        placeholder="Descripción"
                      />
                      {updating && (
                        <span className="font-mono text-[10px] tracking-widest text-warn uppercase">actualiza</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeShot(scene.key, shot.key)}
                        className="link-action font-mono text-[10px] tracking-widest uppercase"
                      >
                        Quitar
                      </button>
                    </div>

                    {(shot.shotType || shot.camera || shot.lens || shot.audio || shot.notes) && (
                      <div className="mt-2 flex flex-wrap gap-2 pl-7">
                        <input
                          value={shot.shotType ?? ""}
                          onChange={(e) => updateShot(scene.key, shot.key, { shotType: e.target.value })}
                          className={`${inputClass} w-32 text-xs`}
                          placeholder="Tipo de plano"
                        />
                        <input
                          value={shot.camera ?? ""}
                          onChange={(e) => updateShot(scene.key, shot.key, { camera: e.target.value })}
                          className={`${inputClass} w-24 text-xs`}
                          placeholder="Cámara"
                        />
                        <input
                          value={shot.lens ?? ""}
                          onChange={(e) => updateShot(scene.key, shot.key, { lens: e.target.value })}
                          className={`${inputClass} w-24 text-xs`}
                          placeholder="Lente"
                        />
                        <input
                          value={shot.audio ?? ""}
                          onChange={(e) => updateShot(scene.key, shot.key, { audio: e.target.value })}
                          className={`${inputClass} w-36 text-xs`}
                          placeholder="Audio"
                        />
                        <input
                          value={shot.notes ?? ""}
                          onChange={(e) => updateShot(scene.key, shot.key, { notes: e.target.value })}
                          className={`${inputClass} min-w-40 flex-1 text-xs`}
                          placeholder="Notas"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="flex items-center gap-4">
        <button onClick={submit} disabled={pending || totals.on === 0} className="btn btn-primary">
          {pending ? "Importando…" : `Añadir ${totals.on} plano${totals.on === 1 ? "" : "s"}`}
        </button>
        <button onClick={discard} disabled={pending} className="link-action">
          Descartar
        </button>
      </div>
    </div>
  );
}
