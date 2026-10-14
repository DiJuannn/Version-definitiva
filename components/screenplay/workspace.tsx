"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, useTransition } from "react";
import type { Editor } from "@tiptap/core";
import type * as Y from "yjs";
import Link from "next/link";
import { uploadScreenplayImage } from "@/lib/actions/screenplays";
import type { ScreenplayBlock } from "@/lib/screenplay/blocks";
import type { StoryMaps } from "@/lib/screenplay/story-doc";
import {
  REFERENCE_KINDS,
  isReferenceKind,
  referenceId,
  safeUrl,
  type Reference,
  type ReferenceAnchor,
  type SceneInfo,
  type SceneMeta,
  type Suggestion,
} from "@/lib/screenplay/story";

// Los tres pasos del guion. Ninguno es obligatorio: se puede empezar por
// cualquiera y saltar de uno a otro cuando se quiera.
export type Step = "idea" | "escaleta" | "guion";

export const STEPS: { id: Step; label: string }[] = [
  { id: "idea", label: "Idea" },
  { id: "escaleta", label: "Escaleta" },
  { id: "guion", label: "Guion" },
];

export function isStep(v: unknown): v is Step {
  return v === "idea" || v === "escaleta" || v === "guion";
}

export type Workspace = {
  screenplayId: string;
  ydoc: Y.Doc;
  maps: StoryMaps;
  editor: Editor | null;
  blocks: ScreenplayBlock[];
  scenes: SceneInfo[];
  characters: { name: string; lines: number }[];
  currentSid: string | null;
  userName: string;
  linkedProject: { id: string; name: string } | null;
  goToScene: (sid: string) => void;
  moveScene: (sid: string, toIndex: number) => void;
  addScene: (heading: string, synopsis: string, beforeSid: string | null) => void;
  flushSave: () => Promise<boolean>;
  setStep: (s: Step) => void;
  openCharacter: (name: string) => void;
  openAssistant: () => void;
  // Proponer referencias solas al salir de una escena que se ha escrito.
  autoRefs: boolean;
  setAutoRefs: (on: boolean) => void;
  autoBusy: string | null; // sid de la escena para la que se están buscando
};

const Ctx = createContext<Workspace | null>(null);
export const WorkspaceProvider = Ctx.Provider;

export function useWorkspace(): Workspace {
  const w = useContext(Ctx);
  if (!w) throw new Error("useWorkspace fuera del espacio de trabajo del guion");
  return w;
}

// ------------------------------------------------------------------ escrituras en el documento

export function updateSceneMeta(maps: StoryMaps, sid: string, patch: Partial<SceneMeta>) {
  const prev = maps.scenes.get(sid) ?? {};
  maps.scenes.set(sid, { ...prev, ...patch });
}

export function addReference(maps: StoryMaps, ref: Reference) {
  maps.refs.set(ref.id, ref);
}

export function suggestionsOf(ai: Record<string, unknown>): Suggestion[] {
  return Array.isArray(ai.suggestions) ? (ai.suggestions as Suggestion[]) : [];
}

export function dropSuggestion(maps: StoryMaps, id: string) {
  maps.ai.set(
    "suggestions",
    suggestionsOf(maps.ai.toJSON()).filter((s) => s.id !== id),
  );
}

export function acceptSuggestion(maps: StoryMaps, s: Suggestion, userName: string) {
  addReference(maps, { ...s, source: "ai", by: userName, at: Date.now() });
  dropSuggestion(maps, s.id);
}

// Añade a la bandeja lo nuevo de la IA sin repetir obras que ya estén
// guardadas o pendientes de revisar (mismo título, sin mirar mayúsculas).
export function pushSuggestions(maps: StoryMaps, incoming: Suggestion[]) {
  const norm = (t: string) => t.trim().toLowerCase();
  const pending = suggestionsOf(maps.ai.toJSON());
  const known = new Set([...pending.map((x) => norm(x.title)), ...[...maps.refs.values()].map((r) => norm(r.title))]);
  const fresh = incoming.filter((x) => !known.has(norm(x.title)));
  maps.ai.set("suggestions", [...fresh, ...pending].slice(0, 60));
  return fresh.length;
}

export const NOTHING_NEW = "Todo lo que ha propuesto ya lo tienes. Prueba otra vez.";

export function anchorKey(a: ReferenceAnchor): string {
  return a.type === "scene" ? `scene:${a.sid}` : a.type === "character" ? `character:${a.name}` : "script";
}

export function anchorLabel(a: ReferenceAnchor, scenes: SceneInfo[]): string {
  if (a.type === "scene") {
    const s = scenes.find((x) => x.sid === a.sid);
    return s ? `Escena ${s.number}` : "Escena borrada";
  }
  if (a.type === "character") return a.name;
  return "Toda la historia";
}

// ------------------------------------------------------------------ piezas comunes

// Botón de ayuda de IA: guarda primero (la IA lee lo último), enseña que
// está pensando y muestra el error en su sitio.
export function AiButton({
  label,
  pendingLabel = "Leyendo el guion…",
  run,
  className,
}: {
  label: string;
  pendingLabel?: string;
  run: () => Promise<{ ok: true } | { ok: false; error: string; upgrade?: boolean }>;
  className?: string;
}) {
  const { flushSave } = useWorkspace();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ text: string; upgrade?: boolean } | null>(null);
  return (
    <div className={className}>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            await flushSave();
            const res = await run();
            if (!res.ok) setError({ text: res.error, upgrade: res.upgrade });
          })
        }
        className="sp-ai-btn"
      >
        <span aria-hidden className={`sp-ai-dot ${pending ? "animate-pulse" : ""}`} />
        {pending ? pendingLabel : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-danger">
          {error.text}{" "}
          {error.upgrade && (
            <Link href="/app/organizacion" className="underline">
              Ver planes
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

// Texto editable en el sitio: crece con lo escrito y se guarda al salir.
export function InlineText({
  value,
  onSave,
  placeholder,
  rows = 1,
  className,
  label,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder: string;
  rows?: number;
  className?: string;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const text = draft ?? value;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  return (
    <textarea
      ref={ref}
      aria-label={label}
      value={text}
      placeholder={placeholder}
      rows={rows}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== value) onSave(draft.trim());
        setDraft(null);
      }}
      className={`block w-full resize-none overflow-hidden rounded-md bg-transparent outline-none placeholder:text-[#a3a3a8] focus:bg-white focus:shadow-[0_0_0_6px_#fff,0_0_0_7px_var(--line)] ${className ?? ""}`}
    />
  );
}

// Subida de una imagen (fichas y referencias). Devuelve la URL pública.
export function useImageUpload() {
  const { screenplayId } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = useCallback(
    async (file: File): Promise<string | null> => {
      setBusy(true);
      setError(null);
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadScreenplayImage(screenplayId, fd).catch(() => ({ error: "No se pudo subir la imagen." }));
      setBusy(false);
      if ("error" in res) {
        setError(res.error);
        return null;
      }
      return res.url;
    },
    [screenplayId],
  );
  return { upload, busy, error };
}

// ------------------------------------------------------------------ referencias

export function ReferenceItem({
  item,
  scenes,
  onDelete,
  onAccept,
  showAnchor,
}: {
  item: Reference | Suggestion;
  scenes: SceneInfo[];
  onDelete: () => void;
  onAccept?: () => void;
  showAnchor?: boolean;
}) {
  const suggestion = Boolean(onAccept);
  const url = safeUrl(item.url);
  return (
    <article className={suggestion ? "sp-suggested" : "py-3"}>
      <div className="flex gap-3">
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element -- imagen subida por el equipo, tamaño libre
          <img src={item.image} alt="" className="h-14 w-20 shrink-0 rounded-md object-cover" />
        )}
        <div className="min-w-0">
          <p className="text-[12px] text-muted">
            {REFERENCE_KINDS[item.kind] ?? "Referencia"}
            {showAnchor && <> · {anchorLabel(item.anchor, scenes)}</>}
            {suggestion && <span className="text-[var(--ai)]"> · propuesta de la IA</span>}
          </p>
          <p className="mt-0.5 text-[15px] leading-snug font-semibold">
            {url ? (
              <a href={url} target="_blank" rel="noreferrer" className="underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--accent)]">
                {item.title}
              </a>
            ) : (
              item.title
            )}
            {(item.year || item.author) && (
              <span className="font-normal text-muted"> · {[item.author, item.year].filter(Boolean).join(", ")}</span>
            )}
          </p>
          {item.detail && <p className="mt-1 text-[13.5px] leading-relaxed text-[#3a3a40]">{item.detail}</p>}
          <div className="mt-2 flex gap-4 text-[12.5px]">
            {onAccept && (
              <button type="button" onClick={onAccept} className="font-semibold text-[var(--accent)] hover:underline">
                Guardar
              </button>
            )}
            <button type="button" onClick={onDelete} className="text-muted hover:text-danger">
              {suggestion ? "Descartar" : "Quitar"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

const FIELD =
  "w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition-colors placeholder:text-[#a3a3a8] focus:border-[var(--accent)]";

export function ReferenceForm({ anchor, onDone }: { anchor: ReferenceAnchor; onDone: () => void }) {
  const { maps, userName } = useWorkspace();
  const [kind, setKind] = useState<string>("film");
  const [image, setImage] = useState<string | null>(null);
  const { upload, busy, error } = useImageUpload();

  const submit = (fd: FormData) => {
    const title = String(fd.get("title") ?? "").trim().slice(0, 160);
    if (!title) return;
    addReference(maps, {
      id: referenceId(),
      kind: isReferenceKind(kind) ? kind : "other",
      title,
      year: String(fd.get("year") ?? "").trim().slice(0, 12) || undefined,
      author: String(fd.get("author") ?? "").trim().slice(0, 120) || undefined,
      url: safeUrl(fd.get("url")),
      image: image ?? undefined,
      detail: String(fd.get("detail") ?? "").trim().slice(0, 600) || undefined,
      anchor,
      source: "manual",
      by: userName,
      at: Date.now(),
    });
    onDone();
  };

  return (
    <form action={submit} className="flex flex-col gap-2.5 rounded-lg border border-[var(--line)] bg-[#fafaf8] p-3">
      <select aria-label="Tipo de referencia" value={kind} onChange={(e) => setKind(e.target.value)} className={FIELD}>
        {Object.entries(REFERENCE_KINDS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <input name="title" required maxLength={160} placeholder="Título (p. ej. Cinema Paradiso)" className={FIELD} />
      <div className="grid grid-cols-[1fr_88px] gap-2">
        <input name="author" maxLength={120} placeholder="Director/a o autor/a" className={FIELD} />
        <input name="year" maxLength={12} placeholder="Año" className={FIELD} />
      </div>
      <input name="url" type="url" placeholder="Enlace (opcional)" className={FIELD} />
      <textarea name="detail" rows={2} maxLength={600} placeholder="¿Qué tiene que te sirva?" className={`${FIELD} resize-none`} />
      <label className="flex items-center gap-3 text-[13px] text-muted">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa de la imagen subida
          <img src={image} alt="" className="h-10 w-14 rounded object-cover" />
        ) : null}
        <span className="cursor-pointer underline-offset-4 hover:underline">
          {busy ? "Subiendo…" : image ? "Cambiar imagen" : "Añadir imagen (opcional)"}
        </span>
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setImage(await upload(f));
          }}
        />
      </label>
      {error && <p className="text-[13px] text-danger">{error}</p>}
      <div className="flex items-center gap-4 pt-1">
        <button type="submit" disabled={busy} className="rounded-md bg-[var(--fg)] px-3.5 py-2 text-[13px] font-medium text-white">
          Añadir
        </button>
        <button type="button" onClick={onDone} className="text-[13px] text-muted hover:text-fg">
          Cancelar
        </button>
      </div>
    </form>
  );
}
