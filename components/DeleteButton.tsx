"use client";

import { useEffect, useState, type ComponentPropsWithoutRef } from "react";
import { useFormStatus } from "react-dom";

// Confirmación en dos clics en vez de window.confirm(): el diálogo nativo no
// es fiable en todos los navegadores/webviews móviles (puede quedar
// deshabilitado o no aparecer), lo que hacía que "Eliminar" pareciera no
// hacer nada. Este patrón funciona igual en cualquier navegador.
export function DeleteButton({
  children = "Eliminar",
  className,
  // Aceptado pero sin usar: quedó de antes de pasar a confirmación en dos
  // clics, y sigue en la firma para no tener que tocar los ~22 sitios que
  // todavía lo pasan. Se saca aquí explícitamente para que no caiga en
  // `...rest` y acabe como atributo desconocido en el <button> del DOM.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  confirmMessage: _confirmMessage,
  ...rest
}: {
  children?: React.ReactNode;
  confirmMessage?: string;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"button">, "type" | "onClick" | "children" | "className">) {
  const [confirming, setConfirming] = useState(false);
  const { pending } = useFormStatus();

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const baseClassName =
    className ??
    "font-mono text-[11px] tracking-widest text-muted uppercase transition hover:text-accent active:scale-[0.97]";

  // Borrar tarda un momento real (servidor + revalidar) — sin este aviso,
  // el botón se queda quieto y parece que el clic no hizo nada.
  if (pending) {
    return (
      <button
        type="submit"
        disabled
        className={`${baseClassName} inline-flex items-center gap-1.5 opacity-70`}
        {...rest}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
        Eliminando…
      </button>
    );
  }

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
