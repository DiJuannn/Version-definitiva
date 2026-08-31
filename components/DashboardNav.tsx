"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// "/app" solo está activo en la home exacta — si no, "Taller" se quedaría
// marcado como actual en cualquier página del propio proyecto también.
function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNav({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Cierra el menú al cambiar de página — ajustar el estado durante el
  // render (en vez de en un efecto) evita un parpadeo del menú abierto
  // antes de cerrarse en la navegación siguiente.
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <>
      {/* Móvil (<sm): igual que antes — botón de menú + lista vertical. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Abrir menú"
        className="mt-4 flex items-center gap-2 font-mono text-xs tracking-widest text-muted uppercase sm:hidden"
      >
        <span className="flex h-4 w-5 flex-col justify-between">
          <span
            className={`h-px w-full bg-current transition-transform ${open ? "translate-y-[7px] rotate-45" : ""}`}
          />
          <span className={`h-px w-full bg-current transition-opacity ${open ? "opacity-0" : ""}`} />
          <span
            className={`h-px w-full bg-current transition-transform ${open ? "-translate-y-[7px] -rotate-45" : ""}`}
          />
        </span>
        Menú
      </button>
      <nav className={`${open ? "flex" : "hidden"} mt-4 flex-col gap-4 sm:hidden`}>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="font-mono text-xs tracking-widest text-muted uppercase transition hover:text-accent active:opacity-60"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Tablet (sm a lg): igual que antes — fila plana sin resaltar activo. */}
      <nav className="mt-4 hidden flex-row flex-wrap gap-6 sm:flex lg:hidden">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="font-mono text-xs tracking-widest text-muted uppercase transition hover:text-accent active:opacity-60"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Escritorio (lg+): chips con la página actual resaltada. */}
      <nav className="mt-4 hidden flex-wrap gap-2 lg:flex">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`border px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase transition active:scale-[0.97] ${
                active
                  ? "border-accent bg-accent text-bg"
                  : "border-line text-muted hover:border-accent hover:text-accent"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
