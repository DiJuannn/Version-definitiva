"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { motion } from "motion/react";
import { DURATION } from "@/lib/motion";

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
      className={`${
        className ??
        "btn btn-secondary btn-sm"
      } ${pending ? "inline-flex items-center gap-1.5" : ""}`}
    >
      {pending && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {pending ? (
        pendingLabel
      ) : justSaved && savedLabel ? (
        // Pequeño "pop" al confirmar: se nota que se ha guardado sin mirar dos veces.
        <motion.span
          className="inline-block"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: DURATION.standard, ease: [0.34, 1.56, 0.64, 1] }}
        >
          {savedLabel}
        </motion.span>
      ) : (
        children
      )}
    </button>
  );
}
