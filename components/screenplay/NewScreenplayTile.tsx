"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { NewScreenplayForm } from "@/components/screenplay/NewScreenplayForm";
import { createScreenplay } from "@/lib/actions/screenplays";

// La primera portada de la mesa es una hoja en blanco: al pulsarla se crea
// un guion nuevo (o se importa uno).
export function NewScreenplayTile({ empty }: { empty: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="sp-cover sp-cover-blank group w-full text-left">
        {/* Sombra suavizada para la mesa clara (la de .sp-cover-sheet es para fondo negro). */}
        <span className="sp-cover-sheet grid place-items-center shadow-[0_0_0_1px_rgb(29_28_33/0.05),0_1px_2px_rgb(29_28_33/0.08),0_14px_28px_-18px_rgb(29_28_33/0.3)]! group-hover:shadow-[0_0_0_1px_var(--accent),0_22px_36px_-20px_rgb(29_28_33/0.35)]!">
          <span className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#5a46a8] font-sans text-2xl leading-none text-[#f6f4ee] shadow-[0_6px_16px_-6px_rgb(90_70_168/0.6)] transition-transform group-hover:scale-105">
              +
            </span>
            <span className="mt-4 block font-[family-name:var(--font-courier)] text-[13px] font-bold tracking-wide text-[#1c1b19] uppercase">
              Nuevo guion
            </span>
            <span className="mt-1.5 block px-6 font-sans text-[12px] leading-snug text-[#6f6a5f]">
              {empty ? "La página en blanco es el primer paso" : "En blanco, o importa un PDF o Fountain"}
            </span>
          </span>
        </span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo guion">
        <div className="mt-5">
          <NewScreenplayForm action={createScreenplay} />
        </div>
      </Modal>
    </>
  );
}
