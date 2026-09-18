"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { importReviewedScriptAnalysis } from "@/lib/actions/script-analysis";
import { SectionTabs } from "@/components/SectionTabs";
import { useToast } from "@/components/Toast";
import { BREAKDOWN_CATEGORY_LABELS, DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";

type Proposal = {
  characters: { name: string; notes?: string }[];
  locations: { name: string; notes?: string }[];
  props: { name: string; category?: string }[];
  scenes: {
    number: string;
    intExt?: string;
    dayPart?: string;
    locationName?: string;
    description?: string;
    action?: string;
    dialogueNotes?: string;
    characterNames?: string[];
    propNames?: string[];
  }[];
};

type Existing = {
  characters: string[];
  locations: string[];
  props: string[];
  sceneNumbers: string[];
};

type Row = { key: string; on: boolean; name: string; notes: string; category: string };
type SceneRow = {
  key: string;
  on: boolean;
  number: string;
  intExt: string;
  dayPart: string;
  locationName: string;
  description: string;
  action: string;
  dialogueNotes: string;
  characterNames: string[];
  propNames: string[];
};
type State = { characters: Row[]; locations: Row[]; props: Row[]; scenes: SceneRow[] };

const inputClass =
  "w-full border border-line bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-accent";
const smallSelect =
  "border border-line bg-transparent px-2 py-1.5 font-mono text-[11px] text-fg outline-none transition-colors focus:border-accent";
const CATEGORY_KEYS = Object.keys(BREAKDOWN_CATEGORY_LABELS);

// Aleatoria (no un contador): las claves se guardan en el borrador y no deben chocar con las nuevas.
const nextKey = () => `r${Math.random().toString(36).slice(2, 10)}`;
const lower = (s: string) => s.trim().toLowerCase();

// Firma del estado sin las claves internas (aleatorias en cada carga): sirve para saber si hay cambios reales.
function signature(state: State): string {
  const strip = <T extends { key: string }>(rows: T[]) => rows.map((r) => ({ ...r, key: "" }));
  return JSON.stringify({
    characters: strip(state.characters),
    locations: strip(state.locations),
    props: strip(state.props),
    scenes: strip(state.scenes),
  });
}

function initialState(proposal: Proposal, existing: Existing): State {
  const has = (set: string[], name: string) => set.includes(lower(name));
  return {
    characters: proposal.characters.map((c) => ({
      key: nextKey(),
      on: !has(existing.characters, c.name),
      name: c.name,
      notes: c.notes ?? "",
      category: "",
    })),
    locations: proposal.locations.map((l) => ({
      key: nextKey(),
      on: !has(existing.locations, l.name),
      name: l.name,
      notes: l.notes ?? "",
      category: "",
    })),
    props: proposal.props.map((p) => ({
      key: nextKey(),
      on: !has(existing.props, p.name),
      name: p.name,
      notes: "",
      category: CATEGORY_KEYS.includes(p.category ?? "") ? (p.category as string) : "PROP",
    })),
    scenes: proposal.scenes.map((s) => ({
      key: nextKey(),
      on: true,
      number: s.number,
      intExt: s.intExt ?? "",
      dayPart: s.dayPart ?? "",
      locationName: s.locationName ?? "",
      description: s.description ?? "",
      action: s.action ?? "",
      dialogueNotes: s.dialogueNotes ?? "",
      characterNames: s.characterNames ?? [],
      propNames: s.propNames ?? [],
    })),
  };
}

// "nuevo" se importará; "existe" ya está en el proyecto (se omite); "repetido"
// ya aparece antes en esta misma lista.
function statusOf(rows: Row[], index: number, existingNames: string[]): "nuevo" | "existe" | "repetido" {
  const name = lower(rows[index].name);
  if (!name) return "nuevo";
  if (existingNames.includes(name)) return "existe";
  if (rows.slice(0, index).some((r) => lower(r.name) === name)) return "repetido";
  return "nuevo";
}

export function ScriptAnalysisReview({
  projectId,
  analysisId,
  proposal,
  existing,
}: {
  projectId: string;
  analysisId: string;
  proposal: Proposal;
  existing: Existing;
}) {
  const original = useMemo(() => initialState(proposal, existing), [proposal, existing]);
  const [state, setState] = useState<State>(original);
  const [pending, startTransition] = useTransition();
  const [restored, setRestored] = useState(false);
  const { toast } = useToast();
  const storageKey = `analysis-draft:${analysisId}`;
  const loaded = useRef(false);

  // Borrador: la revisión de un guion largo lleva rato, así que las
  // correcciones se guardan en este navegador y se recuperan al volver.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as State;
        if (parsed && Array.isArray(parsed.characters) && Array.isArray(parsed.scenes)) {
          setState(parsed);
          setRestored(signature(parsed) !== signature(original));
        }
      }
    } catch {
      // sin almacenamiento: se trabaja sin borrador
    }
    loaded.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      // Sin cambios no hay borrador que guardar (ni que avisar al volver).
      if (signature(state) === signature(original)) window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // idem
    }
  }, [state, storageKey, original]);

  function patchRows(kind: "characters" | "locations" | "props", update: (rows: Row[]) => Row[]) {
    setState((s) => ({ ...s, [kind]: update(s[kind]) }));
  }

  // Renombrar una entrada actualiza también las escenas que la citan.
  function rename(kind: "characters" | "locations" | "props", key: string, name: string) {
    setState((s) => {
      const previous = s[kind].find((r) => r.key === key)?.name ?? "";
      const rows = s[kind].map((r) => (r.key === key ? { ...r, name } : r));
      if (!name.trim() || lower(previous) === lower(name)) return { ...s, [kind]: rows };
      const swap = (list: string[]) => list.map((n) => (lower(n) === lower(previous) ? name : n));
      const scenes = s.scenes.map((sc) => {
        if (kind === "characters") return { ...sc, characterNames: swap(sc.characterNames) };
        if (kind === "props") return { ...sc, propNames: swap(sc.propNames) };
        return lower(sc.locationName) === lower(previous) ? { ...sc, locationName: name } : sc;
      });
      return { ...s, [kind]: rows, scenes };
    });
  }

  function remove(kind: "characters" | "locations" | "props", key: string) {
    setState((s) => {
      const gone = s[kind].find((r) => r.key === key)?.name ?? "";
      const rows = s[kind].filter((r) => r.key !== key);
      const drop = (list: string[]) => list.filter((n) => lower(n) !== lower(gone));
      const scenes = s.scenes.map((sc) => {
        if (kind === "characters") return { ...sc, characterNames: drop(sc.characterNames) };
        if (kind === "props") return { ...sc, propNames: drop(sc.propNames) };
        return lower(sc.locationName) === lower(gone) ? { ...sc, locationName: "" } : sc;
      });
      return { ...s, [kind]: rows, scenes };
    });
  }

  function add(kind: "characters" | "locations" | "props") {
    patchRows(kind, (rows) => [
      { key: nextKey(), on: true, name: "", notes: "", category: "PROP" },
      ...rows,
    ]);
  }

  function patchScene(key: string, patch: Partial<SceneRow>) {
    setState((s) => ({
      ...s,
      scenes: s.scenes.map((sc) => (sc.key === key ? { ...sc, ...patch } : sc)),
    }));
  }

  // Lo que realmente se creará al importar.
  const listOf = (kind: "characters" | "locations" | "props", existingNames: string[]) => {
    const rows = state[kind];
    const created = rows.filter((r, i) => r.on && r.name.trim() && statusOf(rows, i, existingNames) === "nuevo");
    return { created, skipped: rows.filter((r, i) => r.on && r.name.trim() && statusOf(rows, i, existingNames) !== "nuevo").length };
  };
  const chars = listOf("characters", existing.characters);
  const locs = listOf("locations", existing.locations);
  const props = listOf("props", existing.props);
  const scenesOn = state.scenes.filter((s) => s.on && s.number.trim());
  const scenesUpdate = scenesOn.filter((s) => existing.sceneNumbers.includes(s.number.trim())).length;
  const totalToImport = chars.created.length + locs.created.length + props.created.length + scenesOn.length;
  const changed = signature(state) !== signature(original);

  function submit() {
    // Solo se envía lo marcado, y en las escenas solo lo que existirá de verdad
    // tras importar (lo nuevo marcado más lo que ya está en el proyecto).
    const willExistCharacters = new Set([
      ...existing.characters,
      ...state.characters.filter((r) => r.on && r.name.trim()).map((r) => lower(r.name)),
    ]);
    const willExistProps = new Set([
      ...existing.props,
      ...state.props.filter((r) => r.on && r.name.trim()).map((r) => lower(r.name)),
    ]);
    const payload = {
      characters: state.characters.filter((r) => r.on && r.name.trim()).map((r) => ({ name: r.name, notes: r.notes })),
      locations: state.locations.filter((r) => r.on && r.name.trim()).map((r) => ({ name: r.name, notes: r.notes })),
      props: state.props.filter((r) => r.on && r.name.trim()).map((r) => ({ name: r.name, category: r.category })),
      scenes: scenesOn.map((s) => ({
        number: s.number,
        intExt: s.intExt || undefined,
        dayPart: s.dayPart || undefined,
        locationName: s.locationName || undefined,
        description: s.description,
        action: s.action,
        dialogueNotes: s.dialogueNotes,
        characterNames: s.characterNames.filter((n) => willExistCharacters.has(lower(n))),
        propNames: s.propNames.filter((n) => willExistProps.has(lower(n))),
      })),
    };
    startTransition(async () => {
      const result = await importReviewedScriptAnalysis(projectId, analysisId, payload);
      if (result?.error) {
        toast("error", result.error);
        return;
      }
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // nada
      }
    });
  }

  const summary = [
    chars.created.length > 0 && `${chars.created.length} personaje${chars.created.length === 1 ? "" : "s"}`,
    locs.created.length > 0 && `${locs.created.length} localizaci${locs.created.length === 1 ? "ón" : "ones"}`,
    props.created.length > 0 && `${props.created.length} elemento${props.created.length === 1 ? "" : "s"} de desglose`,
    scenesOn.length > 0 &&
      `${scenesOn.length - scenesUpdate > 0 ? `${scenesOn.length - scenesUpdate} escena${scenesOn.length - scenesUpdate === 1 ? "" : "s"} nueva${scenesOn.length - scenesUpdate === 1 ? "" : "s"}` : ""}${
        scenesOn.length - scenesUpdate > 0 && scenesUpdate > 0 ? " y " : ""
      }${scenesUpdate > 0 ? `${scenesUpdate} escena${scenesUpdate === 1 ? "" : "s"} actualizada${scenesUpdate === 1 ? "" : "s"}` : ""}`,
  ].filter(Boolean) as string[];
  const skipped = chars.skipped + locs.skipped + props.skipped;

  const characterOptions = state.characters.map((r) => r.name.trim()).filter(Boolean);
  const propOptions = state.props.map((r) => r.name.trim()).filter(Boolean);
  const locationOptions = [...new Set([...state.locations.map((r) => r.name.trim()).filter(Boolean)])];

  function reset() {
    setState(initialState(proposal, existing));
    setRestored(false);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // nada
    }
  }

  const count = (rows: Row[], names: string[]) => {
    const on = rows.filter((r, i) => r.on && r.name.trim() && statusOf(rows, i, names) === "nuevo").length;
    return `${on}/${rows.length}`;
  };

  return (
    <div>
      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ["1", "Revisa", "La IA ha leído el guion y propone estas listas. Nada se guarda todavía."],
          ["2", "Corrige", "Cambia nombres y categorías, edita las escenas, quita lo que sobre o añade lo que falte."],
          ["3", "Importa", "Al final se crea solo lo marcado. Lo que ya existe en el proyecto se omite."],
        ].map(([n, title, text]) => (
          <li key={n} className="flex gap-3 border border-line p-4">
            <span className="font-display text-2xl leading-none font-black text-accent">{n}</span>
            <div>
              <p className="font-mono text-xs tracking-widest uppercase">{title}</p>
              <p className="mt-1 font-sans text-xs text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ol>

      {restored && (
        <p className="mt-4 flex flex-wrap items-center gap-3 border border-line px-4 py-2.5 font-mono text-xs text-muted">
          Se han recuperado tus correcciones anteriores.
          <button type="button" onClick={reset} className="link-action">
            Volver a la propuesta original
          </button>
        </p>
      )}

      <div className="mt-8">
        <SectionTabs
          ariaLabel="Qué ha encontrado la IA"
          initial="escenas"
          tabs={[
            {
              id: "escenas",
              label: "Escenas",
              count: `${scenesOn.length}/${state.scenes.length}`,
              content: (
                <ScenesTab
                  scenes={state.scenes}
                  existingNumbers={existing.sceneNumbers}
                  characterOptions={characterOptions}
                  propOptions={propOptions}
                  locationOptions={locationOptions}
                  existingLocations={existing.locations}
                  onPatch={patchScene}
                  onAllOn={(on) => setState((s) => ({ ...s, scenes: s.scenes.map((sc) => ({ ...sc, on })) }))}
                />
              ),
            },
            {
              id: "personajes",
              label: "Personajes",
              count: count(state.characters, existing.characters),
              content: (
                <RowsTab
                  noun="personaje"
                  rows={state.characters}
                  existingNames={existing.characters}
                  onToggle={(key, on) => patchRows("characters", (rows) => rows.map((r) => (r.key === key ? { ...r, on } : r)))}
                  onAllOn={(on) => patchRows("characters", (rows) => rows.map((r) => ({ ...r, on })))}
                  onRename={(key, name) => rename("characters", key, name)}
                  onNotes={(key, notes) => patchRows("characters", (rows) => rows.map((r) => (r.key === key ? { ...r, notes } : r)))}
                  onRemove={(key) => remove("characters", key)}
                  onAdd={() => add("characters")}
                  withNotes
                />
              ),
            },
            {
              id: "localizaciones",
              label: "Localizaciones",
              count: count(state.locations, existing.locations),
              content: (
                <RowsTab
                  noun="localización"
                  rows={state.locations}
                  existingNames={existing.locations}
                  onToggle={(key, on) => patchRows("locations", (rows) => rows.map((r) => (r.key === key ? { ...r, on } : r)))}
                  onAllOn={(on) => patchRows("locations", (rows) => rows.map((r) => ({ ...r, on })))}
                  onRename={(key, name) => rename("locations", key, name)}
                  onNotes={(key, notes) => patchRows("locations", (rows) => rows.map((r) => (r.key === key ? { ...r, notes } : r)))}
                  onRemove={(key) => remove("locations", key)}
                  onAdd={() => add("locations")}
                  withNotes
                />
              ),
            },
            {
              id: "desglose",
              label: "Desglose",
              count: count(state.props, existing.props),
              content: (
                <RowsTab
                  noun="elemento"
                  rows={state.props}
                  existingNames={existing.props}
                  onToggle={(key, on) => patchRows("props", (rows) => rows.map((r) => (r.key === key ? { ...r, on } : r)))}
                  onAllOn={(on) => patchRows("props", (rows) => rows.map((r) => ({ ...r, on })))}
                  onRename={(key, name) => rename("props", key, name)}
                  onRemove={(key) => remove("props", key)}
                  onAdd={() => add("props")}
                  onCategory={(key, category) => patchRows("props", (rows) => rows.map((r) => (r.key === key ? { ...r, category } : r)))}
                  hint="La IA propone una categoría para cada elemento; cámbiala si no es la correcta."
                />
              ),
            },
          ]}
        />
      </div>

      {/* Barra de importación: resumen vivo de lo que se creará. */}
      <div className="sticky bottom-24 z-20 mt-10 flex items-center justify-between gap-4 border border-line bg-bg-raised/95 p-3 backdrop-blur-md sm:bottom-4 sm:gap-6 sm:p-4">
        <div className="min-w-0">
          <p className="hidden font-mono text-[10px] tracking-widest text-muted uppercase sm:block">Se importará</p>
          <p className="font-sans text-xs sm:mt-1 sm:text-sm">
            {totalToImport === 0 ? "Nada seleccionado todavía." : summary.join(" · ")}
          </p>
          {skipped > 0 && (
            <p className="mt-1 hidden font-mono text-[11px] text-muted sm:block">
              {skipped} marcado{skipped === 1 ? "" : "s"} ya existe{skipped === 1 ? "" : "n"} en el proyecto y se omite{skipped === 1 ? "" : "n"}.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {changed && (
            <button type="button" onClick={reset} className="link-action">
              Deshacer cambios
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={pending || totalToImport === 0}
            className="btn btn-primary disabled:opacity-50"
          >
            {pending ? "Importando…" : "Importar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Badge({ kind }: { kind: "nuevo" | "existe" | "repetido" | "actualiza" }) {
  const map = {
    nuevo: ["Nuevo", "border-success/50 text-success"],
    existe: ["Ya existe · se omite", "border-line text-muted"],
    repetido: ["Repetido", "border-warn/50 text-warn"],
    actualiza: ["Actualiza la escena existente", "border-warn/50 text-warn"],
  } as const;
  const [label, cls] = map[kind];
  return (
    <span className={`shrink-0 border px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase ${cls}`}>
      {label}
    </span>
  );
}

function RowsTab({
  noun,
  rows,
  existingNames,
  onToggle,
  onAllOn,
  onRename,
  onNotes,
  onRemove,
  onAdd,
  onCategory,
  withNotes,
  hint,
}: {
  noun: string;
  rows: Row[];
  existingNames: string[];
  onToggle: (key: string, on: boolean) => void;
  onAllOn: (on: boolean) => void;
  onRename: (key: string, name: string) => void;
  onNotes?: (key: string, notes: string) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
  onCategory?: (key: string, category: string) => void;
  withNotes?: boolean;
  hint?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !q || r.name.toLowerCase().includes(q));

  return (
    <div>
      {hint && <p className="mb-3 font-sans text-xs text-muted">{hint}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {rows.length > 8 && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar ${noun}…`}
            aria-label={`Buscar ${noun}`}
            className="w-full border border-line bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-accent sm:w-56"
          />
        )}
        <button type="button" onClick={() => onAllOn(true)} className="link-action">
          Marcar todos
        </button>
        <button type="button" onClick={() => onAllOn(false)} className="link-action">
          Quitar marcas
        </button>
        <button type="button" onClick={onAdd} className="btn btn-outline btn-sm ml-auto">
          + Añadir {noun}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 font-mono text-sm text-muted">La IA no ha propuesto ningún {noun}. Puedes añadirlos a mano.</p>
      ) : (
        <ul className="mt-4 border-t border-line">
          {visible.map(({ r, i }) => {
            const status = statusOf(rows, i, existingNames);
            const dim = status !== "nuevo" || !r.on;
            return (
              <li key={r.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-2.5">
                <input
                  type="checkbox"
                  checked={r.on}
                  onChange={(e) => onToggle(r.key, e.target.checked)}
                  aria-label={`Importar ${r.name || noun}`}
                  className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <input
                  value={r.name}
                  onChange={(e) => onRename(r.key, e.target.value)}
                  placeholder={`Nombre del ${noun}`}
                  aria-label={`Nombre del ${noun}`}
                  className={`min-w-0 flex-1 basis-40 ${inputClass} ${dim ? "text-muted" : ""}`}
                />
                {onCategory && (
                  <select
                    value={r.category}
                    onChange={(e) => onCategory(r.key, e.target.value)}
                    aria-label="Categoría"
                    className={smallSelect}
                  >
                    {Object.entries(BREAKDOWN_CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value} className="bg-bg">
                        {label}
                      </option>
                    ))}
                  </select>
                )}
                {r.name.trim() && <Badge kind={status} />}
                <button
                  type="button"
                  onClick={() => onRemove(r.key)}
                  aria-label={`Quitar ${r.name || noun}`}
                  className="link-action"
                >
                  Quitar
                </button>
                {withNotes && onNotes && (
                  <input
                    value={r.notes}
                    onChange={(e) => onNotes(r.key, e.target.value)}
                    placeholder="Notas (opcional)"
                    aria-label="Notas"
                    className={`w-full ${inputClass} text-xs text-muted sm:ml-7 sm:w-[calc(100%-1.75rem)]`}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ChipPicker({
  label,
  selected,
  options,
  onChange,
}: {
  label: string;
  selected: string[];
  options: string[];
  onChange: (next: string[]) => void;
}) {
  const remaining = options.filter((o) => !selected.some((s) => lower(s) === lower(o)));
  return (
    <div>
      <p className="font-mono text-[10px] tracking-widest text-muted uppercase">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {selected.map((name, i) => (
          <span key={`${name}-${i}`} className="inline-flex items-center gap-1.5 border border-line px-2 py-1 font-mono text-xs">
            {name}
            <button
              type="button"
              onClick={() => onChange(selected.filter((_, j) => j !== i))}
              aria-label={`Quitar ${name}`}
              className="text-muted hover:text-danger"
            >
              ×
            </button>
          </span>
        ))}
        {remaining.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && onChange([...selected, e.target.value])}
            aria-label={`Añadir a ${label.toLowerCase()}`}
            className={smallSelect}
          >
            <option value="" className="bg-bg">
              + Añadir
            </option>
            {remaining.map((o) => (
              <option key={o} value={o} className="bg-bg">
                {o}
              </option>
            ))}
          </select>
        )}
        {selected.length === 0 && remaining.length === 0 && (
          <span className="font-mono text-xs text-muted">Ninguno</span>
        )}
      </div>
    </div>
  );
}

function ScenesTab({
  scenes,
  existingNumbers,
  characterOptions,
  propOptions,
  locationOptions,
  existingLocations,
  onPatch,
  onAllOn,
}: {
  scenes: SceneRow[];
  existingNumbers: string[];
  characterOptions: string[];
  propOptions: string[];
  locationOptions: string[];
  existingLocations: string[];
  onPatch: (key: string, patch: Partial<SceneRow>) => void;
  onAllOn: (on: boolean) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const listId = "analysis-locations";

  if (scenes.length === 0) {
    return <p className="font-mono text-sm text-muted">La IA no ha propuesto ninguna escena.</p>;
  }

  return (
    <div>
      <datalist id={listId}>
        {[...new Set([...locationOptions, ...existingLocations])].map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => onAllOn(true)} className="link-action">
          Marcar todas
        </button>
        <button type="button" onClick={() => onAllOn(false)} className="link-action">
          Quitar marcas
        </button>
        <span className="ml-auto font-mono text-[11px] text-muted">Pulsa &ldquo;Editar&rdquo; para corregir los detalles de una escena.</span>
      </div>

      <ul className="mt-4 space-y-3">
        {scenes.map((s) => {
          const isOpen = open === s.key;
          const updates = existingNumbers.includes(s.number.trim());
          return (
            <li key={s.key} className={`border p-4 ${s.on ? "border-line" : "border-line opacity-60"}`}>
              <div className="flex flex-wrap items-start gap-3">
                <input
                  type="checkbox"
                  checked={s.on}
                  onChange={(e) => onPatch(s.key, { on: e.target.checked })}
                  aria-label={`Importar escena ${s.number}`}
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-base font-bold">Escena {s.number || "—"}</p>
                    {s.number.trim() && <Badge kind={updates ? "actualiza" : "nuevo"} />}
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    {[
                      s.intExt ? INT_EXT_LABELS[s.intExt as keyof typeof INT_EXT_LABELS] : null,
                      s.dayPart ? DAY_PART_LABELS[s.dayPart as keyof typeof DAY_PART_LABELS] : null,
                      s.locationName || null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos de escena"}
                  </p>
                  {!isOpen && (s.description || s.action) && (
                    <p className="mt-1.5 line-clamp-2 font-sans text-xs text-muted">{s.description || s.action}</p>
                  )}
                  {!isOpen && (s.characterNames.length > 0 || s.propNames.length > 0) && (
                    <p className="mt-1.5 font-mono text-[11px] text-muted">
                      {[
                        s.characterNames.length > 0 ? `${s.characterNames.length} personaje${s.characterNames.length === 1 ? "" : "s"}` : null,
                        s.propNames.length > 0 ? `${s.propNames.length} elemento${s.propNames.length === 1 ? "" : "s"}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : s.key)}
                  aria-expanded={isOpen}
                  className="btn btn-outline btn-sm shrink-0"
                >
                  {isOpen ? "Cerrar" : "Editar"}
                </button>
              </div>

              {isOpen && (
                <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Número</span>
                    <input value={s.number} onChange={(e) => onPatch(s.key, { number: e.target.value })} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Localización</span>
                    <input
                      value={s.locationName}
                      onChange={(e) => onPatch(s.key, { locationName: e.target.value })}
                      list={listId}
                      placeholder="Elige una o escribe otra"
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Interior / exterior</span>
                    <select value={s.intExt} onChange={(e) => onPatch(s.key, { intExt: e.target.value })} className={inputClass}>
                      <option value="" className="bg-bg">Sin indicar</option>
                      {Object.entries(INT_EXT_LABELS).map(([v, l]) => (
                        <option key={v} value={v} className="bg-bg">{l}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Momento del día</span>
                    <select value={s.dayPart} onChange={(e) => onPatch(s.key, { dayPart: e.target.value })} className={inputClass}>
                      <option value="" className="bg-bg">Sin indicar</option>
                      {Object.entries(DAY_PART_LABELS).map(([v, l]) => (
                        <option key={v} value={v} className="bg-bg">{l}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Resumen</span>
                    <textarea rows={2} value={s.description} onChange={(e) => onPatch(s.key, { description: e.target.value })} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Acción</span>
                    <textarea rows={3} value={s.action} onChange={(e) => onPatch(s.key, { action: e.target.value })} className={inputClass} />
                  </label>
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Diálogos y notas</span>
                    <textarea rows={2} value={s.dialogueNotes} onChange={(e) => onPatch(s.key, { dialogueNotes: e.target.value })} className={inputClass} />
                  </label>
                  <div className="sm:col-span-2">
                    <ChipPicker
                      label="Personajes en la escena"
                      selected={s.characterNames}
                      options={characterOptions}
                      onChange={(next) => onPatch(s.key, { characterNames: next })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <ChipPicker
                      label="Elementos de desglose"
                      selected={s.propNames}
                      options={propOptions}
                      onChange={(next) => onPatch(s.key, { propNames: next })}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
