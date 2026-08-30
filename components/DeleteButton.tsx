"use client";

import { useEffect, useState, type ComponentPropsWithoutRef } from "react";

// Confirmación en dos clics en vez de window.confirm(): el diálogo nativo no
// es fiable en todos los navegadores/webviews móviles (puede quedar
// deshabilitado o no aparecer), lo que hacía que "Eliminar" pareciera no
// hacer nada. Este patrón funciona igual en cualquier navegador.
export function DeleteButton({
  children = "Eliminar",
  className,
  ...rest
}: {
  children?: React.ReactNode;
  confirmMessage?: string;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"button">, "type" | "onClick" | "children" | "className">) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const baseClassName =
    className ??
    "font-mono text-[11px] tracking-widest text-muted uppercase transition hover:text-accent active:scale-[0.97]";

  if (confirming) {
    return (
      <button type="submit" className={`${baseClassName} text-accent`} {...rest}>
        ¿Seguro? Confirmar
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={baseClassName}
      {...rest}
    >
      {children}
    </button>
  );
}
