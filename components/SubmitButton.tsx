"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
  savedLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  // Si se pasa, el botón muestra este texto brevemente justo después de que
  // el envío termine — confirmación de guardado sin tocar la Server Action.
  savedLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const [prevPending, setPrevPending] = useState(pending);
  const [justSaved, setJustSaved] = useState(false);

  // Ajuste de estado durante el render (no en un efecto): detecta la
  // transición pending true→false para marcar "recién guardado".
  if (pending !== prevPending) {
    setPrevPending(pending);
    if (!pending && savedLabel) setJustSaved(true);
  }

  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), 1600);
    return () => clearTimeout(timer);
  }, [justSaved]);

  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "rounded-full bg-fg px-4 py-1.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
      }
    >
      {pending ? pendingLabel : justSaved && savedLabel ? savedLabel : children}
    </button>
  );
}
