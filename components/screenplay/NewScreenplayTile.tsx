"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { NewScreenplayForm } from "@/components/screenplay/NewScreenplayForm";
import { createScreenplayStart } from "@/lib/actions/screenplay-guided";
import { COVER_SHADOW } from "@/components/screenplay/cover-shadow";

function NewScreenplayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Nuevo guion" size="md">
      <div className="mt-5">
        <NewScreenplayForm action={createScreenplayStart} />
      </div>
    </Modal>
  );
}

// Acción principal de la cabecera de la mesa de guiones.
export function NewScreenplayButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        + Nuevo guion
      </button>
      <NewScreenplayModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// La primera portada de la mesa es una hoja en blanco: al pulsarla se crea
// un guion nuevo (o se importa uno).
export function NewScreenplayTile({ empty }: { empty: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="sp-cover sp-cover-blank group w-full text-left">
        <span className={`sp-cover-sheet grid place-items-center ${COVER_SHADOW}`}>
          <span className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#5a46a8] font-sans text-2xl leading-none text-[#f6f4ee] shadow-[0_6px_16px_-6px_rgb(90_70_168/0.6)] transition-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
              +
            </span>
            <span className="mt-4 block font-[family-name:var(--font-courier)] text-[13px] font-bold tracking-wide text-[#1c1b19] uppercase">
              Nuevo guion
            </span>
            <span className="mt-1.5 block px-6 font-sans text-[12px] leading-snug text-[#6f6a5f]">
              {empty ? "¿Primera vez? Te guiamos paso a paso" : "Guiado, en blanco o importado"}
            </span>
          </span>
        </span>
      </button>
      <NewScreenplayModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
