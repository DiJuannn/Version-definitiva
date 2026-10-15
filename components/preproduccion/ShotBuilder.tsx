"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGuidedShots } from "@/lib/actions/shots";
import { AngleIcon, MovementIcon, SHOT_SIZE_NAMES, ShotFrame, type ShotSizeKind } from "@/components/preproduccion/ShotFrame";

type Character = { id: string; name: string };
type Draft = { shotSize: ShotSizeKind; angle: string; movement: string; description: string; characterIds: string[] };

// Qué cuenta cada tamaño: la guía de planos, en una línea.
const SIZE_GUIDE: Record<ShotSizeKind, string> = {
  GPG: "El lugar manda: paisaje, ciudad, la soledad del personaje.",
  PG: "Dónde estamos y quién está. Abre la escena (plano de situación).",
  PE: "El cuerpo entero: cómo se mueve, qué hace.",
  PA: "De las rodillas arriba: acción y gesto a la vez.",
  PM: "De la cintura arriba: la conversación, lo cotidiano.",
  PMC: "Del pecho arriba: atención a lo que dice y siente.",
  PP: "La cara: la emoción, el momento que importa.",
  PPP: "Los ojos, la boca: tensión máxima, lo íntimo.",
  PD: "Un objeto o un gesto que la historia necesita ver.",
};
const SIZES = Object.keys(SIZE_GUIDE) as ShotSizeKind[];

const ANGLES: [string, string][] = [
  ["Normal", "A la altura de los ojos: neutral."],
  ["Picado", "Desde arriba: empequeñece, vulnera."],
  ["Contrapicado", "Desde abajo: da poder o amenaza."],
  ["Cenital", "Vertical desde arriba: mapa, extrañeza."],
  ["Nadir", "Vertical desde abajo: vértigo."],
  ["Holandés", "Inclinado: algo no va bien."],
];
const MOVEMENTS: [string, string][] = [
  ["Fijo", "La cámara no se mueve: observa."],
  ["Panorámica", "Gira sobre sí misma: sigue o descubre."],
  ["Travelling", "Se desplaza: acompaña al personaje."],
  ["Steadicam", "Flota siguiendo la acción."],
  ["Cámara en mano", "Tiembla: urgencia, documental."],
  ["Grúa", "Sube o baja: revela, cierra la escena."],
  ["Zoom", "Cambia el tamaño sin moverse: subraya."],
];

const CHIP = "flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-sans text-[13px] transition-colors";
const chip = (on: boolean) => `${CHIP} ${on ? "border-accent bg-accent/15 text-fg" : "border-line text-muted hover:text-fg"}`;

export function ShotBuilder({
  projectId,
  sceneId,
  sceneNumber,
  place,
  characters,
  nextNumber,
}: {
  projectId: string;
  sceneId: string;
  sceneNumber: string;
  place: string | null;
  characters: Character[];
  nextNumber: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const allIds = characters.map((c) => c.id);
  const [draft, setDraft] = useState<Draft>({ shotSize: "PM", angle: "Normal", movement: "Fijo", description: "", characterIds: allIds });
  const [batch, setBatch] = useState<Draft[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const nameOf = (id: string) => characters.find((c) => c.id === id)?.name ?? "";

  const send = (shots: Draft[], label: string) =>
    start(async () => {
      const n = await createGuidedShots(projectId, sceneId, shots);
      setDone(n ? `✓ ${label}` : "No se ha podido añadir. Inténtalo otra vez.");
      setBatch([]);
      setDraft((d) => ({ ...d, description: "" }));
      router.refresh();
    });

  // Coberturas: los planos que se suelen rodar para que la escena se pueda montar.
  const shot = (shotSize: ShotSizeKind, description: string, characterIds: string[], movement = "Fijo", angle = "Normal"): Draft => ({
    shotSize,
    angle,
    movement,
    description,
    characterIds,
  });
  const cast = characters.slice(0, 3);
  const presets: { key: string; label: string; hint: string; make: () => Draft[]; disabled?: boolean }[] = [
    {
      key: "situacion",
      label: "Plano de situación",
      hint: "Un plano general que dice dónde estamos.",
      make: () => [shot("PG", `Situación${place ? `: ${place.toLowerCase()}` : ""}`, allIds)],
    },
    {
      key: "master",
      label: "Máster + cobertura",
      hint: "Toda la escena en general, y luego cada personaje más cerca.",
      make: () => [
        shot("PG", "Máster: la escena entera de principio a fin", allIds),
        ...cast.map((c) => shot("PM", `${c.name} en plano medio`, [c.id])),
        ...cast.map((c) => shot("PP", `Reacción de ${c.name}`, [c.id])),
      ],
    },
    {
      key: "contraplano",
      label: "Plano / contraplano",
      hint: "Una conversación entre dos: cada uno sobre el hombro del otro.",
      disabled: characters.length < 2,
      make: () => {
        const [a, b] = characters;
        return [
          shot("PMC", `${a.name} sobre el hombro de ${b.name}`, [a.id, b.id]),
          shot("PMC", `${b.name} sobre el hombro de ${a.name}`, [a.id, b.id]),
          shot("PP", `${a.name}, reacción`, [a.id]),
          shot("PP", `${b.name}, reacción`, [b.id]),
        ];
      },
    },
    {
      key: "inserto",
      label: "Inserto",
      hint: "El detalle que el espectador tiene que ver.",
      make: () => [shot("PD", "Detalle: ", [])],
    },
  ];

  return (
    <div className={`space-y-8 ${pending ? "opacity-70" : ""}`}>
      {/* Coberturas rápidas */}
      <section>
        <h3 className="font-display text-base font-bold">Empieza con una cobertura</h3>
        <p className="mt-1 font-sans text-sm text-muted">Los planos de siempre para que la escena se pueda montar. Los revisas antes de añadirlos.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              disabled={p.disabled}
              onClick={() => setBatch(p.make())}
              className="tile p-3.5 text-left transition hover:shadow-[0_0_0_1px_var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="block font-sans text-[14px] font-semibold">{p.label}</span>
              <span className="mt-0.5 block font-sans text-[12px] leading-snug text-muted">
                {p.disabled ? "Necesita dos personajes en la escena." : p.hint}
              </span>
            </button>
          ))}
        </div>

        {batch.length > 0 && (
          <div className="paper mt-4 p-4">
            <ol className="divide-y divide-line">
              {batch.map((s, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                  <ShotFrame size={s.shotSize} className="h-9 w-16 shrink-0 rounded" />
                  <span className="w-10 font-mono text-[12px] font-semibold">
                    {sceneNumber}.{nextNumber + i}
                  </span>
                  <span className="w-9 font-mono text-[11px] text-muted">{s.shotSize}</span>
                  <input
                    value={s.description}
                    onChange={(e) => setBatch((b) => b.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                    aria-label={`Descripción del plano ${i + 1}`}
                    className="field min-w-0 flex-1 py-1.5 text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={() => setBatch((b) => b.filter((_, j) => j !== i))}
                    aria-label="Quitar este plano"
                    className="text-muted hover:text-danger"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex items-center gap-4">
              <button type="button" className="btn btn-primary" disabled={pending} onClick={() => send(batch, `${batch.length} planos añadidos`)}>
                Añadir {batch.length} {batch.length === 1 ? "plano" : "planos"}
              </button>
              <button type="button" className="link-action" onClick={() => setBatch([])}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Un plano a medida */}
      <section className="border-t border-line pt-8">
        <h3 className="font-display text-base font-bold">
          O un plano a medida <span className="font-mono text-sm font-normal text-muted">· {sceneNumber}.{nextNumber + batch.length}</span>
        </h3>

        <p className="eyebrow mt-5">Tamaño · qué cuenta</p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 xl:grid-cols-9">
          {SIZES.map((size) => {
            const on = draft.shotSize === size;
            return (
              <button
                key={size}
                type="button"
                onClick={() => set("shotSize", size)}
                aria-pressed={on}
                title={SIZE_GUIDE[size]}
                className={`rounded-lg p-1.5 text-left transition ${on ? "bg-accent/15 shadow-[0_0_0_1.5px_var(--accent)]" : "hover:bg-bg-raised"}`}
              >
                <ShotFrame size={size} className="aspect-video w-full rounded" />
                <span className="mt-1 block font-mono text-[11px] font-semibold">{size}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 font-sans text-[13px]">
          <b className="font-semibold">{SHOT_SIZE_NAMES[draft.shotSize]}:</b> <span className="text-muted">{SIZE_GUIDE[draft.shotSize]}</span>
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Ángulo</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ANGLES.map(([a, hint]) => (
                <button key={a} type="button" title={hint} aria-pressed={draft.angle === a} onClick={() => set("angle", a)} className={chip(draft.angle === a)}>
                  <AngleIcon angle={a} className="h-3.5 w-3.5" />
                  {a}
                </button>
              ))}
            </div>
            <p className="mt-1.5 font-sans text-[12px] text-muted">{ANGLES.find(([a]) => a === draft.angle)?.[1]}</p>
          </div>
          <div>
            <p className="eyebrow">Movimiento</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MOVEMENTS.map(([m, hint]) => (
                <button key={m} type="button" title={hint} aria-pressed={draft.movement === m} onClick={() => set("movement", m)} className={chip(draft.movement === m)}>
                  <MovementIcon movement={m} className="h-3.5 w-3.5" />
                  {m}
                </button>
              ))}
            </div>
            <p className="mt-1.5 font-sans text-[12px] text-muted">{MOVEMENTS.find(([m]) => m === draft.movement)?.[1]}</p>
          </div>
        </div>

        {characters.length > 0 && (
          <div className="mt-6">
            <p className="eyebrow">Quién sale</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {characters.map((c) => {
                const on = draft.characterIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("characterIds", on ? draft.characterIds.filter((x) => x !== c.id) : [...draft.characterIds, c.id])}
                    className={chip(on)}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <label className="mt-6 block">
          <span className="eyebrow">Qué se ve</span>
          <textarea
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            placeholder={
              draft.characterIds.length
                ? `${draft.characterIds.map(nameOf).join(" y ")} …`
                : "La claqueta en las manos de…"
            }
            className="field mt-1.5 w-full"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => send([draft], `Plano ${sceneNumber}.${nextNumber} añadido`)}>
            Añadir el plano {sceneNumber}.{nextNumber}
          </button>
          {done && (
            <p role="status" className={`font-sans text-sm ${done.startsWith("✓") ? "text-success" : "text-danger"}`}>
              {done}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
