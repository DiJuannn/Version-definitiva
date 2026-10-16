"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { referenceId, type LooseIdea } from "@/lib/screenplay/story";
import { useWorkspace } from "@/components/screenplay/workspace";

type CoachResult = { ok: true; question: string; why: string } | { ok: false; error: string; upgrade?: boolean };

// El compañero: UNA pregunta sobre lo que se acaba de escribir, nunca una
// respuesta. Solo aparece si se pide (un botón pequeño), y lo que pregunta
// se puede guardar en Ideas sueltas para pensarlo luego.
export function CoachCard({ label, run, disabled }: { label: string; run: () => Promise<CoachResult>; disabled?: boolean }) {
  const { maps, userName } = useWorkspace();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ question: string; why: string } | null>(null);
  const [error, setError] = useState<{ text: string; upgrade?: boolean } | null>(null);
  const [why, setWhy] = useState(false);
  const [saved, setSaved] = useState(false);

  const ask = () =>
    start(async () => {
      setError(null);
      setWhy(false);
      setSaved(false);
      const res = await run().catch(() => ({ ok: false as const, error: "No se ha podido conectar. Inténtalo otra vez." }));
      if (res.ok) setResult({ question: res.question, why: res.why });
      else setError({ text: res.error, upgrade: "upgrade" in res ? res.upgrade : undefined });
    });

  if (!result) {
    return (
      <div>
        <button type="button" onClick={ask} disabled={pending || disabled} className="sp-ai-btn disabled:opacity-50">
          <span aria-hidden className={`sp-ai-dot ${pending ? "animate-pulse" : ""}`} />
          {pending ? "Pensando una pregunta…" : label}
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

  const save = () => {
    const idea: LooseIdea = { id: referenceId(), text: result.question, kind: "otro", at: Date.now(), by: userName };
    maps.loose.set(idea.id, idea);
    setSaved(true);
  };

  return (
    <div role="status" className="rounded-[var(--r-lg)] border border-dashed border-[#e3b25c] bg-[#fffaf0] px-4 py-3.5 text-[14px] leading-relaxed text-[#6b4a00]">
      <p>
        <span className="font-semibold">✦ Una pregunta, no una respuesta:</span> {result.question}
      </p>
      <p className="mt-1 text-[12.5px] text-[#8a6a2a]">
        No hace falta contestarla ahora.{" "}
        <button type="button" onClick={() => setWhy((v) => !v)} aria-expanded={why} className="underline underline-offset-2 hover:text-[#6b4a00]">
          ¿Por qué me lo preguntas?
        </button>
      </p>
      {why && result.why && <p className="mt-1.5 text-[12.5px] text-[#8a6a2a] italic">{result.why}</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px]">
        <button
          type="button"
          onClick={save}
          disabled={saved}
          className="rounded-full bg-[#f6e7c4] px-3 py-1 font-medium text-[#6b4a00] hover:bg-[#f0dcae] disabled:opacity-70"
        >
          {saved ? "Guardada en Ideas sueltas ✓" : "Guardar en Ideas sueltas"}
        </button>
        <button type="button" onClick={ask} disabled={pending} className="rounded-full px-3 py-1 text-[#8a6a2a] hover:bg-[#f6e7c4] disabled:opacity-60">
          {pending ? "Pensando…" : "Otra pregunta"}
        </button>
        <button type="button" onClick={() => setResult(null)} className="rounded-full px-3 py-1 text-[#8a6a2a] hover:bg-[#f6e7c4]">
          Ahora no
        </button>
      </div>
      {error && <p className="mt-2 text-[12.5px] text-danger">{error.text}</p>}
    </div>
  );
}
