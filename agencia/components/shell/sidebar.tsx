"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell, Briefcase, CalendarDays, Coins, Folder, Home, Menu, Plus, ScrollText, Settings, UserRound, Users, X,
} from "lucide-react";
import { cx } from "@/components/ui/cx";
import type { NavGroup } from "./nav";

const ICONS = {
  home: Home, folder: Folder, calendar: CalendarDays, users: Users, briefcase: Briefcase,
  coins: Coins, settings: Settings, scroll: ScrollText, plus: Plus,
} as const;

export function Sidebar({
  groups,
  user,
  unread,
  logout,
}: {
  groups: NavGroup[];
  user: { name: string; roleLabel: string };
  unread: number;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  // El menú móvil se asocia a la ruta en la que se abrió: al navegar se cierra solo.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (v: boolean) => setOpenAt(v ? pathname : null);
  const isActive = (href: string) => pathname === href || (href !== "/inicio" && pathname.startsWith(href + "/")) || pathname === href;

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/inicio" className="font-display text-lg font-extrabold tracking-tight">
          Corte<span className="text-[#d9a900]">/</span>
        </Link>
        <Link
          href="/avisos"
          className={cx("relative rounded-md p-2 text-ink-2 hover:bg-black/5 hover:text-ink", pathname === "/avisos" && "bg-black/5 text-ink")}
          aria-label={unread ? `Avisos, ${unread} sin leer` : "Avisos"}
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-marker px-1 font-mono text-[10px] font-semibold text-ink">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Principal">
        {groups.map((g, i) => (
          <div key={i} className="mt-3 first:mt-1">
            {g.label && <p className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">{g.label}</p>}
            <ul className="flex flex-col gap-0.5">
              {g.items.map((item) => {
                const Icon = ICONS[item.icon as keyof typeof ICONS] ?? Folder;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "relative flex h-9 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                        active ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-ink-2 hover:bg-black/5 hover:text-ink",
                      )}
                    >
                      {active && <span aria-hidden className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-marker" />}
                      <Icon className="size-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-2">
        <Link href="/cuenta" className="flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-black/5">
          <span className="grid size-8 place-items-center rounded-full bg-ink text-[13px] font-semibold text-white">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block text-xs text-ink-3">{user.roleLabel}</span>
          </span>
          <UserRound className="ml-auto size-4 text-ink-3" />
        </Link>
        <form action={logout}>
          <button type="submit" className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-[13px] text-ink-3 hover:bg-black/5 hover:text-ink">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-line bg-bg/95 px-3 backdrop-blur md:hidden">
        <button type="button" onClick={() => setOpen(true)} className="rounded-md p-2 hover:bg-black/5" aria-label="Abrir menú" aria-expanded={open}>
          <Menu className="size-5" />
        </button>
        <Link href="/inicio" className="font-display font-extrabold">
          Corte<span className="text-[#d9a900]">/</span>
        </Link>
        <Link href="/avisos" className="relative rounded-md p-2" aria-label="Avisos">
          <Bell className="size-5" />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-marker ring-2 ring-bg" />}
        </Link>
      </div>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-line md:block">{content}</aside>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button type="button" className="absolute inset-0 bg-black/30" aria-label="Cerrar menú" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-bg shadow-xl">
            <button type="button" onClick={() => setOpen(false)} className="absolute top-3 right-3 rounded-md p-1.5 hover:bg-black/5" aria-label="Cerrar menú">
              <X className="size-5" />
            </button>
            {content}
          </div>
        </div>
      )}
    </>
  );
}
