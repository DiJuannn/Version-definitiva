"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";

// Botón que abre un formulario en un diálogo, para que la acción de crear no
// sea un formulario siempre abierto encima de la lista. El formulario llega
// ya pintado desde el servidor (children); dentro, <CloseOnSaved /> cierra el
// diálogo cuando el envío termina, y <ModalCancel /> lo cierra a mano.

const CloseContext = createContext<() => void>(() => {});

export function FormModal({
  label,
  title,
  description,
  className = "btn btn-primary",
  children,
}: {
  label: ReactNode;
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>
      <Modal open={open} onClose={close} title={title} description={description}>
        <CloseContext.Provider value={close}>{children}</CloseContext.Provider>
      </Modal>
    </>
  );
}

// Va dentro del <form>: al pasar de «enviando» a «terminado», cierra.
export function CloseOnSaved() {
  const { pending } = useFormStatus();
  const close = useContext(CloseContext);
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending) wasPending.current = true;
    else if (wasPending.current) {
      wasPending.current = false;
      close();
    }
  }, [pending, close]);

  return null;
}

export function ModalCancel({ children = "Cancelar" }: { children?: ReactNode }) {
  const close = useContext(CloseContext);
  return (
    <button type="button" onClick={close} className="link-action">
      {children}
    </button>
  );
}
