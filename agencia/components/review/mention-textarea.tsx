"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { cx } from "@/components/ui/cx";

type Person = { id: string; name: string };

/** Textarea con autocompletado de @menciones (solo personas autorizadas). */
export const MentionTextarea = forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    onChange: (v: string) => void;
    people: Person[];
    onMention: (p: Person) => void;
    onSubmit: () => void;
    onFocus?: () => void;
    placeholder?: string;
    rows?: number;
    ariaLabel: string;
    className?: string;
    disabled?: boolean;
  }
>(function MentionTextarea({ value, onChange, people, onMention, onSubmit, onFocus, placeholder, rows = 3, ariaLabel, className, disabled }, fwd) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(fwd, () => ref.current!);
  const [query, setQuery] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const matches = query !== null ? people.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6) : [];

  const detect = (text: string, caret: number) => {
    const m = /(^|\s)@([\p{L}\p{N}._-]{0,30})$/u.exec(text.slice(0, caret));
    setQuery(m ? m[2] : null);
    setIdx(0);
  };

  const pick = (p: Person) => {
    const el = ref.current!;
    const caret = el.selectionStart;
    const before = value.slice(0, caret).replace(/@([\p{L}\p{N}._-]{0,30})$/u, `@${p.name} `);
    const next = before + value.slice(caret);
    onChange(next);
    onMention(p);
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        disabled={disabled}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onFocus={onFocus}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (matches.length) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIdx((i) => (i + 1) % matches.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIdx((i) => (i - 1 + matches.length) % matches.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              pick(matches[idx]);
              return;
            }
            if (e.key === "Escape") {
              setQuery(null);
              return;
            }
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
          if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur();
        }}
        className={cx(
          "w-full resize-none rounded-md border border-c-line bg-c-bg px-3 py-2 text-sm leading-relaxed text-c-ink placeholder:text-c-ink-3 focus:border-marker/70 focus:outline-none",
          className,
        )}
      />
      {matches.length > 0 && (
        <ul role="listbox" aria-label="Mencionar a" className="absolute bottom-full left-0 z-30 mb-1 w-64 overflow-hidden rounded-md border border-c-line bg-c-panel-2 py-1 shadow-xl">
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === idx}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(p);
                }}
                className={cx("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm", i === idx ? "bg-white/10 text-c-ink" : "text-c-ink-2")}
              >
                <span className="grid size-5 place-items-center rounded-full bg-white/10 text-[11px]">{p.name[0]}</span>
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
