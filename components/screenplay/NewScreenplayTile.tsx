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
        <span className="sp-cover-sheet grid place-items-center">
          <span className="text-center">
            <span className="block font-[family-name:var(--font-courier)] text-5xl leading-none text-[#c9c4b8] transition-colors group-hover:text-[#5a46a8]">
              +
            </span>
            <span className="mt-3 block font-[family-name:var(--font-courier)] text-[13px] font-bold tracking-wide text-[#6f6a5f] uppercase">
              Nuevo guion
            </span>
            <span className="mt-1 block px-6 font-sans text-[12px] text-[#8f897c]">
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
