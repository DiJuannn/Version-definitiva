"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import {
  NOTE_COLORS,
  REFERENCE_KINDS,
  type MoodboardCard,
  type MoodboardLookup,
} from "@/lib/moodboard-types";

// Una sola clase de nodo ("card") que pinta un tipo u otro según card.type.
export type CardNode = Node<{ card: MoodboardCard }, "card">;

type BoardContext = {
  projectId: string;
  lookup: MoodboardLookup;
  update: (id: string, patch: Partial<MoodboardCard>) => void;
  remove: (id: string) => void;
};

const BoardCtx = createContext<BoardContext | null>(null);
export const BoardProvider = BoardCtx.Provider;

function useBoard(): BoardContext {
  const ctx = useContext(BoardCtx);
  if (!ctx) throw new Error("BoardProvider ausente");
  return ctx;
}

const FIELD =
  "nodrag nowheel w-full bg-transparent outline-none placeholder:opacity-50 focus:bg-white/5";
const LABEL = "font-mono text-[9px] tracking-widest uppercase";

function Frame({
  id,
  selected,
  minW = 140,
  minH = 70,
  className = "",
  style,
  children,
}: {
  id: string;
  selected: boolean;
  minW?: number;
  minH?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { remove } = useBoard();
  return (
    <div className="group relative h-full w-full">
      <NodeResizer
        minWidth={minW}
        minHeight={minH}
        isVisible={selected}
        lineClassName="border-accent!"
        handleClassName="h-2.5! w-2.5! rounded-none! border-accent! bg-bg!"
      />
      <button
        type="button"
        onClick={() => remove(id)}
        aria-label="Quitar tarjeta"
        className="nodrag absolute top-1 right-1 z-10 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white hover:bg-danger group-hover:flex focus-visible:flex"
      >
        ×
      </button>
      <div className={`h-full w-full overflow-hidden ${className}`} style={style}>
        {children}
      </div>
    </div>
  );
}

function NoteCard({ id, card, selected }: { id: string; card: MoodboardCard; selected: boolean }) {
  const { update } = useBoard();
  return (
    <Frame id={id} selected={selected} className="shadow-lg" style={{ background: card.color ?? NOTE_COLORS[0], color: "#1a1a1a" }}>
      <div className="flex h-full flex-col p-3">
        <textarea
          value={card.text ?? ""}
          onChange={(e) => update(id, { text: e.target.value })}
          placeholder="Escribe una nota…"
          maxLength={2000}
          aria-label="Texto de la nota"
          className={`${FIELD} min-h-0 flex-1 resize-none font-sans text-sm leading-snug`}
        />
        {selected && (
          <div className="nodrag mt-2 flex gap-1.5" role="group" aria-label="Color de la nota">
            {NOTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={card.color === c}
                onClick={() => update(id, { color: c })}
                className={`h-4 w-4 rounded-full border ${card.color === c ? "border-black" : "border-black/20"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        )}
      </div>
    </Frame>
  );
}

function ImageCard({ id, card, selected }: { id: string; card: MoodboardCard; selected: boolean }) {
  const { update } = useBoard();
  return (
    <Frame id={id} selected={selected} minW={100} minH={80} className="border border-line bg-bg-raised">
      <div className="flex h-full flex-col">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.url}
          alt={card.caption ?? "Imagen del moodboard"}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="min-h-0 w-full flex-1 object-cover"
        />
        <input
          value={card.caption ?? ""}
          onChange={(e) => update(id, { caption: e.target.value })}
          placeholder="Pie de foto"
          maxLength={200}
          aria-label="Pie de foto"
          className={`${FIELD} shrink-0 px-2 py-1.5 font-sans text-xs text-fg`}
        />
      </div>
    </Frame>
  );
}

function PaletteCard({ id, card, selected }: { id: string; card: MoodboardCard; selected: boolean }) {
  const { update } = useBoard();
  const colors = card.colors ?? [];
  const setColor = (i: number, value: string) =>
    update(id, { colors: colors.map((c, j) => (j === i ? value : c)) });

  return (
    <Frame id={id} selected={selected} minW={160} minH={100} className="border border-line bg-bg-raised">
      <div className="flex h-full flex-col p-2.5">
        <input
          value={card.title ?? ""}
          onChange={(e) => update(id, { title: e.target.value })}
          placeholder="Paleta"
          maxLength={120}
          aria-label="Nombre de la paleta"
          className={`${FIELD} mb-2 font-mono text-[11px] tracking-widest text-fg uppercase`}
        />
        <div className="flex min-h-0 flex-1 gap-1">
          {colors.map((color, i) => (
            <div key={i} className="group/sw relative flex min-w-0 flex-1 flex-col">
              <label className="nodrag relative block min-h-0 flex-1 cursor-pointer" style={{ background: color }}>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(i, e.target.value)}
                  aria-label={`Color ${i + 1}`}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
              <span className={`${LABEL} mt-1 truncate text-center text-muted`}>{color}</span>
              {colors.length > 1 && (
                <button
                  type="button"
                  aria-label={`Quitar color ${i + 1}`}
                  onClick={() => update(id, { colors: colors.filter((_, j) => j !== i) })}
                  className="nodrag absolute top-0.5 right-0.5 hidden h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[10px] leading-none text-white group-hover/sw:flex"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {colors.length < 8 && (
            <button
              type="button"
              aria-label="Añadir color"
              onClick={() => update(id, { colors: [...colors, "#888888"] })}
              className="nodrag w-6 shrink-0 self-stretch border border-dashed border-line text-muted hover:border-accent hover:text-accent"
            >
              +
            </button>
          )}
        </div>
      </div>
    </Frame>
  );
}

function ReferenceCard({ id, card, selected }: { id: string; card: MoodboardCard; selected: boolean }) {
  const { update } = useBoard();
  const query = encodeURIComponent(`${card.title ?? ""} ${card.year ?? ""} ${card.kind === "Fotografía" ? "fotografía" : ""}`.trim());
  return (
    <Frame id={id} selected={selected} minW={180} minH={110} className="border border-line bg-bg-raised">
      <div className="flex h-full flex-col gap-1.5 p-3">
        <div className="flex items-center gap-2">
          <select
            value={card.kind ?? "Otro"}
            onChange={(e) => update(id, { kind: e.target.value })}
            aria-label="Tipo de referencia"
            className={`nodrag ${LABEL} shrink-0 border border-line bg-bg px-1 py-0.5 text-accent`}
          >
            {REFERENCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            value={card.year ?? ""}
            onChange={(e) => update(id, { year: e.target.value })}
            placeholder="Año"
            maxLength={12}
            aria-label="Año"
            className={`${FIELD} w-14 shrink-0 font-mono text-[11px] text-muted`}
          />
        </div>
        <input
          value={card.title ?? ""}
          onChange={(e) => update(id, { title: e.target.value })}
          placeholder="Título"
          maxLength={160}
          aria-label="Título de la referencia"
          className={`${FIELD} font-display text-base leading-tight font-bold text-fg`}
        />
        <textarea
          value={card.why ?? ""}
          onChange={(e) => update(id, { why: e.target.value })}
          placeholder="¿Qué te sirve de esta referencia?"
          maxLength={700}
          aria-label="Por qué sirve"
          className={`${FIELD} min-h-0 flex-1 resize-none font-sans text-xs leading-snug text-muted`}
        />
        {card.title && (
          <a
            href={`https://www.google.com/search?q=${query}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`nodrag ${LABEL} self-start text-accent hover:underline`}
          >
            Buscar ↗
          </a>
        )}
      </div>
    </Frame>
  );
}

function LiveCard({ id, card, selected }: { id: string; card: MoodboardCard; selected: boolean }) {
  const { lookup, projectId } = useBoard();
  const label = card.label?.toLowerCase();

  let heading = "";
  let title = "";
  let detail: string | null = null;
  let extra: string | null = null;
  let href = "";
  let found = false;

  if (card.type === "scene") {
    const scene = lookup.scenes.find((s) => s.id === card.refId) ?? lookup.scenes.find((s) => s.number.toLowerCase() === label);
    heading = "Escena";
    if (scene) {
      found = true;
      title = `Escena ${scene.number}`;
      detail = scene.heading;
      extra = [scene.location, scene.description].filter(Boolean).join(" — ") || null;
      href = `/app/${projectId}/guion/${scene.id}`;
    }
  } else if (card.type === "character") {
    const c = lookup.characters.find((x) => x.id === card.refId) ?? lookup.characters.find((x) => x.name.toLowerCase() === label);
    heading = "Personaje";
    if (c) {
      found = true;
      title = c.name;
      detail = c.actor ? `Interpretado por ${c.actor}` : "Sin actor asignado";
      href = `/app/${projectId}/personajes`;
    }
  } else {
    const l = lookup.locations.find((x) => x.id === card.refId) ?? lookup.locations.find((x) => x.name.toLowerCase() === label);
    heading = "Localización";
    if (l) {
      found = true;
      title = l.name;
      detail = l.address;
      href = `/app/${projectId}/localizaciones`;
    }
  }

  return (
    <Frame id={id} selected={selected} minW={160} minH={90} className="border border-accent/50 bg-bg-raised">
      <div className="flex h-full flex-col gap-1 p-3">
        <p className={`${LABEL} text-accent`}>{heading} · del proyecto</p>
        {found ? (
          <>
            <p className="font-display text-base leading-tight font-bold text-fg">{title}</p>
            {detail && <p className="font-mono text-[11px] text-muted">{detail}</p>}
            {extra && <p className="line-clamp-4 min-h-0 flex-1 overflow-hidden font-sans text-xs leading-snug text-muted">{extra}</p>}
            <Link href={href} className={`nodrag ${LABEL} mt-auto self-start text-accent hover:underline`}>
              Abrir →
            </Link>
          </>
        ) : (
          <p className="font-sans text-xs text-muted">
            «{card.label ?? "?"}» ya no existe en el proyecto. Puedes quitar la tarjeta.
          </p>
        )}
      </div>
    </Frame>
  );
}

export function CardNodeView({ id, data, selected }: NodeProps<CardNode>) {
  const card = data.card;
  if (card.type === "note") return <NoteCard id={id} card={card} selected={selected} />;
  if (card.type === "image") return <ImageCard id={id} card={card} selected={selected} />;
  if (card.type === "palette") return <PaletteCard id={id} card={card} selected={selected} />;
  if (card.type === "reference") return <ReferenceCard id={id} card={card} selected={selected} />;
  return <LiveCard id={id} card={card} selected={selected} />;
}
