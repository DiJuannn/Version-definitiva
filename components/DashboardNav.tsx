"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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

      <nav
        className={`${open ? "flex" : "hidden"} mt-4 flex-col gap-4 sm:mt-4 sm:flex sm:flex-row sm:flex-wrap sm:gap-6`}
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="font-mono text-xs tracking-widest text-muted uppercase transition-colors hover:text-accent"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
