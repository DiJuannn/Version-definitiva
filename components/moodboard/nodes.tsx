"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { FACETS, NOTE_COLORS, REFERENCE_KINDS, type MoodboardCard, type MoodboardLookup } from "@/lib/moodboard-types";

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

// Campos que se escriben directamente sobre la tarjeta: sin caja; al
// enfocarlos, un leve fondo para saber dónde estás escribiendo.
const FIELD =
  "nodrag nowheel w-full rounded-sm bg-transparent outline-none placeholder:text-current placeholder:opacity-40 focus:bg-fg/[0.04]";
const LABEL = "font-mono text-[10px] tracking-widest uppercase";

// Las tarjetas son papeles sobre la mesa: sin borde, con una sombra corta
// y suave (calculada desde el color del texto, así sirve en claro).
const CARD_SHADOW =
  "0 1px 2px color-mix(in srgb, var(--fg) 10%, transparent), 0 12px 28px -16px color-mix(in srgb, var(--fg) 45%, transparent)";

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
        lineClassName="border-accent/70!"
        handleClassName="h-2.5! w-2.5! rounded-full! border-accent! bg-bg-raised!"
      />
      <button
        type="button"
        onClick={() => remove(id)}
        aria-label="Quitar tarjeta"
        title="Quitar del tablero"
        className="nodrag absolute -top-2.5 -right-2.5 z-10 hidden h-6 w-6 items-center justify-center rounded-full bg-fg text-sm leading-none text-bg-raised shadow-md transition-colors hover:bg-danger group-hover:flex focus-visible:flex"
      >
        ×
      </button>
      <div
        className={`h-full w-full overflow-hidden rounded-md transition-shadow ${selected ? "ring-2 ring-accent ring-offset-2 ring-offset-transparent" : ""} ${className}`}
        style={{ boxShadow: CARD_SHADOW, ...style }}
      >
        {children}
      </div>
    </div>
  );
}

// Lo que define la tarjeta y para qué es, en una línea al pie (si lo tiene).
function Tags({ card }: { card: MoodboardCard }) {
  const { lookup } = useBoard();
  const facets = (card.facets ?? []).map((f) => FACETS.find((x) => x.key === f)?.label).filter(Boolean);
  const scenes = (card.scenes ?? []).map((id) => lookup.scenes.find((s) => s.id === id)?.number).filter(Boolean);
  const people = (card.characters ?? []).map((id) => lookup.characters.find((c) => c.id === id)?.name).filter(Boolean);
  const places = (card.locations ?? []).map((id) => lookup.locations.find((l) => l.id === id)?.name).filter(Boolean);
  const parts = [facets.join(" · "), scenes.length ? `esc. ${scenes.join(", ")}` : "", ...people, ...places].filter(Boolean);
  if (!parts.length) return null;
  return <p className={`${LABEL} shrink-0 truncate px-1 pb-1.5 text-[color-mix(in_srgb,currentColor_70%,transparent)]`}>{parts.join(" · ")}</p>;
}

function NoteCard({ id, card, selected }: { id: string; card: MoodboardCard; selected: boolean }) {
  const { update } = useBoard();
  return (
    <Frame
      id={id}
      selected={selected}
      className="rounded-sm"
      style={{ background: card.color ?? NOTE_COLORS[0], color: "#26241f" }}
    >
      <div className="flex h-full flex-col p-3.5">
        <textarea
          value={card.text ?? ""}
          onChange={(e) => update(id, { text: e.target.value })}
          placeholder="Escribe una nota…"
          maxLength={2000}
          aria-label="Texto de la nota"
          className={`${FIELD} min-h-0 flex-1 resize-none font-sans text-[13.5px] leading-snug focus:bg-black/[0.03]`}
        />
        <Tags card={card} />
        {selected && (
          <div className="nodrag mt-2 flex gap-1.5" role="group" aria-label="Color de la nota">
            {NOTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={card.color === c}
                onClick={() => update(id, { color: c })}
                className={`h-4 w-4 rounded-full ring-1 transition-shadow ${card.color === c ? "ring-2 ring-[#26241f]" : "ring-black/20 hover:ring-black/40"}`}
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
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = failedUrl === card.url;
  const setFailed = (v: boolean) => setFailedUrl(v ? (card.url ?? null) : null);
  return (
    <Frame id={id} selected={selected} minW={100} minH={80} className="bg-bg-raised">
      {/* Como una copia en papel: la foto con margen y el pie escrito debajo. */}
      <div className="flex h-full flex-col p-1.5 pb-0">
        {failed ? (
          // Si la foto ya no se puede cargar (enlace caído), se dice claro en
          // vez de dejar el icono roto del navegador.
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-1.5 rounded-[3px] bg-fg/[0.06] px-3 text-center text-muted">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 5h16v14H4zM4 16l4.5-4.5 4 4 2.5-2.5L20 18M3 3l18 18" />
            </svg>
            <span className="font-sans text-[11px] leading-snug">La imagen no se puede cargar</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.url}
            alt={card.caption ?? "Imagen del moodboard"}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setFailed(true)}
            className="min-h-0 w-full flex-1 rounded-[3px] bg-fg/5 object-cover"
          />
        )}
        <input
          value={card.caption ?? ""}
          onChange={(e) => update(id, { caption: e.target.value })}
          placeholder="Pie de foto"
          maxLength={200}
          aria-label="Pie de foto"
          className={`${FIELD} shrink-0 px-1 py-1.5 font-sans text-xs text-fg`}
        />
        {card.colors && card.colors.length > 0 && (
          <div className="flex h-2 shrink-0 overflow-hidden rounded-[2px]" title={card.colors.join(" ")}>
            {card.colors.map((c) => (
              <span key={c} className="flex-1" style={{ background: c }} />
            ))}
          </div>
        )}
        <div className="pt-1">
          <Tags card={card} />
        </div>
      </div>
    </Frame>
  );
}

function PaletteCard({ id, card, selected }: { id: string; card: MoodboardCard; selected: boolean }) {
  const { update } = useBoard();
  const colors = card.colors ?? [];
  const setColor = (i: number, value: string) => update(id, { colors: colors.map((c, j) => (j === i ? value : c)) });

  return (
    <Frame id={id} selected={selected} minW={160} minH={100} className="bg-bg-raised">
      <div className="flex h-full flex-col p-3">
        <input
          value={card.title ?? ""}
          onChange={(e) => update(id, { title: e.target.value })}
          placeholder="Paleta"
          maxLength={120}
          aria-label="Nombre de la paleta"
          className={`${FIELD} mb-2.5 font-mono text-[10px] tracking-widest text-muted uppercase focus:text-fg`}
        />
        <div className="flex min-h-0 flex-1 gap-1.5">
          {colors.map((color, i) => (
            <div key={i} className="group/sw relative flex min-w-0 flex-1 flex-col">
              <label
                className="nodrag relative block min-h-0 flex-1 cursor-pointer rounded-[3px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]"
                style={{ background: color }}
                title="Cambiar color"
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(i, e.target.value)}
                  aria-label={`Color ${i + 1}`}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
              <span className={`${LABEL} mt-1.5 truncate text-center text-muted`}>{color.replace("#", "")}</span>
              {colors.length > 1 && (
                <button
                  type="button"
                  aria-label={`Quitar color ${i + 1}`}
                  onClick={() => update(id, { colors: colors.filter((_, j) => j !== i) })}
                  className="nodrag absolute top-1 right-1 hidden h-4 w-4 items-center justify-center rounded-full bg-fg/70 text-[10px] leading-none text-bg-raised group-hover/sw:flex focus-visible:flex"
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
              title="Añadir color"
              onClick={() => update(id, { colors: [...colors, "#888888"] })}
              className="nodrag mb-5 w-6 shrink-0 self-stretch rounded-[3px] text-muted transition-colors hover:bg-accent/10 hover:text-accent"
            >
              +
            </button>
          )}
        </div>
        <div className="pt-1.5">
          <Tags card={card} />
        </div>
      </div>
    </Frame>
  );
}

function ReferenceCard({ id, card, selected }: { id: string; card: MoodboardCard; selected: boolean }) {
  const { update } = useBoard();
  const query = encodeURIComponent(
    `${card.title ?? ""} ${card.year ?? ""} ${card.kind === "Fotografía" ? "fotografía" : ""}`.trim(),
  );
  return (
    <Frame id={id} selected={selected} minW={180} minH={110} className="bg-bg-raised">
      <div className="flex h-full flex-col gap-1 p-3.5">
        <div className="flex items-center gap-2">
          <select
            value={card.kind ?? "Otro"}
            onChange={(e) => update(id, { kind: e.target.value })}
            aria-label="Tipo de referencia"
            className={`nodrag ${LABEL} shrink-0 cursor-pointer [field-sizing:content] rounded-sm bg-transparent py-0.5 pr-1 text-accent outline-none hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-accent/40`}
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
            className={`${FIELD} w-14 shrink-0 font-mono text-[10px] tracking-wider text-muted`}
          />
        </div>
        <input
          value={card.title ?? ""}
          onChange={(e) => update(id, { title: e.target.value })}
          placeholder="Título"
          maxLength={160}
          aria-label="Título de la referencia"
          className={`${FIELD} font-display text-[15px] leading-tight font-bold text-fg`}
        />
        <textarea
          value={card.why ?? ""}
          onChange={(e) => update(id, { why: e.target.value })}
          placeholder="¿Qué te sirve de esta referencia?"
          maxLength={700}
          aria-label="Por qué sirve"
          className={`${FIELD} mt-0.5 min-h-0 flex-1 resize-none font-sans text-xs leading-snug text-muted`}
        />
        <Tags card={card} />
        {card.title && (
          <a
            href={`https://www.google.com/search?q=${query}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`nodrag ${LABEL} self-start text-accent hover:underline`}
            title="Buscar esta referencia en Google"
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
    const scene =
      lookup.scenes.find((s) => s.id === card.refId) ?? lookup.scenes.find((s) => s.number.toLowerCase() === label);
    heading = "Escena";
    if (scene) {
      found = true;
      title = `Escena ${scene.number}`;
      detail = scene.heading;
      extra = [scene.location, scene.description].filter(Boolean).join(" — ") || null;
      href = `/app/${projectId}/guion/${scene.id}`;
    }
  } else if (card.type === "character") {
    const c =
      lookup.characters.find((x) => x.id === card.refId) ??
      lookup.characters.find((x) => x.name.toLowerCase() === label);
    heading = "Personaje";
    if (c) {
      found = true;
      title = c.name;
      detail = c.actor ? `Interpretado por ${c.actor}` : "Sin actor asignado";
      href = `/app/${projectId}/personajes`;
    }
  } else {
    const l =
      lookup.locations.find((x) => x.id === card.refId) ?? lookup.locations.find((x) => x.name.toLowerCase() === label);
    heading = "Localización";
    if (l) {
      found = true;
      title = l.name;
      detail = l.address;
      href = `/app/${projectId}/localizaciones`;
    }
  }

  return (
    <Frame
      id={id}
      selected={selected}
      minW={160}
      minH={90}
      className={`border-l-[3px] bg-bg-raised ${found ? "border-accent" : "border-warn"}`}
    >
      {/* Tarjeta viva: la raya morada dice que viene del proyecto y se actualiza sola. */}
      <div className="flex h-full flex-col gap-1 p-3.5 pl-3">
        <p
          className={`${LABEL} flex items-center gap-1.5 text-accent`}
          title="Se actualiza sola con los datos del proyecto"
        >
          {heading}
          <span className="text-muted">· del proyecto</span>
        </p>
        {found ? (
          <>
            <p className="font-display text-[15px] leading-tight font-bold text-fg">{title}</p>
            {detail && <p className="font-mono text-[11px] text-muted">{detail}</p>}
            {extra && (
              <p className="line-clamp-4 min-h-0 flex-1 overflow-hidden font-sans text-xs leading-snug text-muted">
                {extra}
              </p>
            )}
            <Link href={href} className={`nodrag ${LABEL} mt-auto self-start text-accent hover:underline`}>
              Abrir →
            </Link>
          </>
        ) : (
          <p className="font-sans text-xs leading-snug text-muted">
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
