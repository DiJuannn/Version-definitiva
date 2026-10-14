"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Modal } from "@/components/Modal";

// Botón «+ Añadir…» que abre el formulario de alta en un <Modal>, para no
// dejar un formulario grande siempre abierto encima de la lista. El
// formulario llega ya renderizado desde el servidor (children) con su Server
// Action; aquí solo se abre y se cierra.
//
// Se cierra solo cuando el alta sale bien: React resetea el <form> tras una
// acción correcta, y ese evento «reset» es la señal. Si la acción falla, el
// formulario no se resetea y el diálogo sigue abierto con lo escrito.
const CloseContext = createContext<(() => void) | null>(null);

// «Cancelar» para poner junto al botón de enviar del formulario. Fuera de un
// CreateDialog (formulario en línea, herramienta vacía) no se pinta.
export function DialogCancel() {
  const close = useContext(CloseContext);
  if (!close) return null;
  return (
    <button type="button" onClick={close} className="link-action">
      Cancelar
    </button>
  );
}

export function CreateDialog({
  label,
  title,
  description,
  variant = "primary",
  size = "md",
  children,
}: {
  label: string;
  title: string;
  description?: string;
  variant?: "primary" | "outline";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`btn ${variant === "primary" ? "btn-primary" : "btn-outline"}`}
      >
        <span aria-hidden className="text-sm leading-none">
          +
        </span>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description} size={size}>
        {/* El formulario desplaza su contenido por si no cabe. */}
        <div
          className="-mx-6 mt-5 max-h-[min(70vh,640px)] overflow-y-auto px-6 pb-1"
          onResetCapture={() => setOpen(false)}
        >
          <CloseContext.Provider value={() => setOpen(false)}>{children}</CloseContext.Provider>
        </div>
      </Modal>
    </>
  );
}
