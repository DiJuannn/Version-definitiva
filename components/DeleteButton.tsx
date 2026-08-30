"use client";

import type { ComponentPropsWithoutRef } from "react";

export function DeleteButton({
  children = "Eliminar",
  confirmMessage = "¿Seguro que quieres eliminarlo? No se puede deshacer.",
  className,
  ...rest
}: {
  children?: React.ReactNode;
  confirmMessage?: string;
  className?: string;
} & Omit<ComponentPropsWithoutRef<"button">, "type" | "onClick" | "children" | "className">) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
      className={
        className ??
        "font-mono text-[11px] tracking-widest text-muted uppercase transition hover:text-accent active:scale-[0.97]"
      }
      {...rest}
    >
      {children}
    </button>
  );
}
