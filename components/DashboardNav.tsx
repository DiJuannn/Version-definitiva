"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState, type ComponentType } from "react";
import {
  BoxIcon,
  CalendarIcon,
  HomeIcon,
  LocationIcon,
  OrganizationIcon,
  PeopleIcon,
  ProjectsIcon,
  TaskIcon,
  VehicleIcon,
  ScriptIcon,
} from "@/components/ToolIcons";
import { useClickOutside } from "@/lib/use-click-outside";

type IconKey =
  | "home"
  | "projects"
  | "calendar"
  | "tasks"
  | "people"
  | "location"
  | "box"
  | "vehicle"
  | "org"
  | "web"
  | "more";

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

const ICONS: Record<IconKey, ComponentType<{ className?: string }>> = {
  home: HomeIcon,
  projects: ProjectsIcon,
  calendar: CalendarIcon,
  tasks: TaskIcon,
  people: PeopleIcon,
  location: LocationIcon,
  box: BoxIcon,
  vehicle: VehicleIcon,
  org: OrganizationIcon,
  web: ScriptIcon,
  more: MoreIcon,
};

export type NavItem = {
  label: string;
  icon: IconKey;
  href?: string;
  children?: { href: string; label: string; icon: IconKey }[];
};

// Rutas de nivel organización: cualquier otra /app/<algo> es un proyecto.
const GLOBAL_SEGMENTS = new Set([
  "proyectos",
  "calendario",
  "tareas",
  "equipo",
  "localizaciones",
  "inventario",
  "vehiculos",
  "organizacion",
  "claqueta",
]);

function isProjectPath(pathname: string) {
  const [, app, segment] = pathname.split("/");
  return app === "app" && Boolean(segment) && !GLOBAL_SEGMENTS.has(segment);
}

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  // "Proyectos" también está activo dentro de cualquier proyecto: así la
  // cabecera siempre dice en qué parte estás.
  if (href === "/app/proyectos" && isProjectPath(pathname)) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function itemActive(pathname: string, item: NavItem) {
  if (item.href) return isActive(pathname, item.href);
  return Boolean(item.children?.some((child) => isActive(pathname, child.href)));
}

const TAB =
  "relative flex items-center gap-1.5 px-3 pt-2.5 pb-3.5 font-mono text-[11px] tracking-widest uppercase transition-colors";

function GroupTab({ item, pathname }: { item: NavItem; pathname: string }) {
  const [open, setOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  const active = itemActive(pathname, item);
  const Icon = ICONS[item.icon];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`${TAB} ${active ? "text-fg" : "text-muted hover:text-fg"}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {item.label}
        <span aria-hidden className="text-[9px] opacity-70">
          ▾
        </span>
        {active && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-accent" />}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 z-40 mt-px w-56 border border-line bg-bg-raised py-1.5 shadow-2xl shadow-black/60"
        >
          {item.children?.map((child) => {
            const ChildIcon = ICONS[child.icon];
            const childActive = isActive(pathname, child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                role="menuitem"
                className={`flex items-center gap-2.5 border-l-2 px-3.5 py-2.5 font-mono text-xs transition ${
                  childActive
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:border-accent/60 hover:text-fg"
                }`}
              >
                <ChildIcon className="h-4 w-4 shrink-0" />
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DashboardNav({ items }: { items: NavItem[] }) {
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
      {/* Móvil y tablet (<lg): botón de menú + lista vertical con los grupos
          desplegados (no se esconde nada). */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Abrir menú"
        className="mt-4 flex min-h-10 items-center gap-2 font-mono text-xs tracking-widest text-muted uppercase lg:hidden"
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
        aria-label="Navegación principal"
        className={`${open ? "flex" : "hidden"} mt-2 flex-col gap-1 lg:hidden`}
      >
        {items.flatMap((item) => {
          const entries = item.children
            ? item.children.map((child) => ({ ...child, group: item.label }))
            : [{ href: item.href!, label: item.label, icon: item.icon, group: null as string | null }];
          return entries.map((entry) => {
            const Icon = ICONS[entry.icon];
            const active = isActive(pathname, entry.href);
            return (
              <Link
                key={entry.href}
                href={entry.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 border-l-2 pl-3 font-mono text-xs tracking-widest uppercase transition ${
                  active
                    ? "border-accent text-fg"
                    : "border-transparent text-muted hover:text-fg"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {entry.label}
                {entry.group && (
                  <span className="ml-auto pr-2 text-[10px] normal-case tracking-normal text-muted/80">
                    {entry.group}
                  </span>
                )}
              </Link>
            );
          });
        })}
      </nav>

      {/* Escritorio (lg+): pestañas con subrayado en la sección actual; el
          margen negativo hace que el subrayado apoye sobre el borde de la
          cabecera. */}
      <nav aria-label="Navegación principal" className="-mb-px mt-3 hidden gap-1 lg:flex">
        {items.map((item) => {
          if (item.children) return <GroupTab key={item.label} item={item} pathname={pathname} />;
          const active = itemActive(pathname, item);
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href!}
              aria-current={active ? "page" : undefined}
              className={`${TAB} ${active ? "text-fg" : "text-muted hover:text-fg"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
              {active && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-accent" />}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
