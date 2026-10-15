"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useClickOutside } from "@/lib/use-click-outside";

// La cuenta, en el avatar: quién eres, la organización y el plan, el editor
// de la web (si eres de la productora) y salir. Así el menú principal solo
// lleva lo que se usa para trabajar.
export function AccountMenu({
  name,
  email,
  links,
  signOutAction,
}: {
  name: string;
  email: string;
  links: { href: string; label: string }[];
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Tu cuenta"
        className="grid h-8 w-8 place-items-center rounded-full bg-[#c9e15a] font-sans text-[13px] font-extrabold text-[#111] ring-offset-2 ring-offset-bg transition hover:ring-2 hover:ring-accent"
      >
        {(name || email).slice(0, 1).toUpperCase()}
      </button>
      {open && (
        <div role="menu" className="menu-panel absolute right-0 z-40 mt-2 w-64">
          <p className="px-3 pt-2 pb-2.5 font-sans text-[13px]">
            <b className="block font-semibold">{name || email}</b>
            {name && <span className="text-muted">{email}</span>}
          </p>
          {links.map((l) => (
            <Link key={l.href} href={l.href} role="menuitem" onClick={close} className="menu-item font-sans text-[14px]">
              {l.label}
            </Link>
          ))}
          <form action={signOutAction}>
            <button type="submit" role="menuitem" className="menu-item w-full font-sans text-[14px]">
              Salir
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
