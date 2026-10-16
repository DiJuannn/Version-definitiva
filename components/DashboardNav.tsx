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
  PenIcon,
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
  | "pen"
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
  pen: PenIcon,
  more: MoreIcon,
};

export type NavItem = {
  label: string;
  icon: IconKey;
  href?: string;
  // Otras rutas que también cuentan como esta sección (Agenda = calendario y tareas).
  also?: string[];
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
  "guiones",
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
  if (item.href) return isActive(pathname, item.href) || Boolean(item.also?.some((h) => isActive(pathname, h)));
  return Boolean(item.children?.some((child) => isActive(pathname, child.href)));
}

// Una sola barra: el menú va en la misma fila que el logo, en letra normal.
const TAB = "relative flex h-14 items-center gap-1.5 px-3 font-sans text-[14px] transition-colors";

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`${TAB} ${active ? "font-semibold text-fg" : "text-muted hover:text-fg"}`}
      >
        {item.label}
        <span aria-hidden className="text-[10px] opacity-70">
          ▾
        </span>
        {active && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-accent" />}
      </button>
      {open && (
        <div
          role="menu"
          className="menu-panel absolute left-0 z-40 mt-1 w-60"
        >
          {item.children?.map((child) => {
            const ChildIcon = ICONS[child.icon];
            const childActive = isActive(pathname, child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                role="menuitem"
                data-active={childActive}
                className="menu-item font-sans text-[14px]"
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
        className="flex min-h-10 items-center gap-2 font-mono text-xs tracking-widest text-muted uppercase lg:hidden"
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
        className={`${open ? "flex" : "hidden"} order-last mt-2 w-full basis-full flex-col gap-1 pb-3 lg:hidden`}
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
      <nav aria-label="Navegación principal" className="-mb-px hidden gap-1 lg:flex">
        {items.map((item) => {
          if (item.children) return <GroupTab key={item.label} item={item} pathname={pathname} />;
          const active = itemActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href!}
              aria-current={active ? "page" : undefined}
              className={`${TAB} ${active ? "font-semibold text-fg" : "text-muted hover:text-fg"}`}
            >
              {item.label}
              {active && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-accent" />}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

// Dentro de un proyecto: las secciones de la organización en un solo botón
// «Menú» (un desplegable), para que la cabecera del proyecto sea una barra.
export function AppMenu({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex min-h-10 items-center gap-2 font-sans text-[14px] text-muted transition-colors hover:text-fg"
      >
        <span aria-hidden className="flex h-3 w-4 flex-col justify-between">
          <span className="h-px w-full bg-current" />
          <span className="h-px w-full bg-current" />
          <span className="h-px w-full bg-current" />
        </span>
        <span className="hidden sm:inline">Menú</span>
      </button>
      {open && (
        <div role="menu" className="menu-panel absolute left-0 z-50 mt-1 w-64">
          {items.map((item) =>
            item.children ? (
              <div key={item.label} className="mt-1 border-t border-line pt-1">
                <p className="px-3 pt-1.5 pb-1 font-mono text-[10px] tracking-[0.16em] text-muted uppercase">{item.label}</p>
                {item.children.map((child) => {
                  const Icon = ICONS[child.icon];
                  return (
                    <Link key={child.href} href={child.href} role="menuitem" data-active={isActive(pathname, child.href)} className="menu-item font-sans text-[14px]">
                      <Icon className="h-4 w-4 shrink-0" />
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            ) : (
              (() => {
                const Icon = ICONS[item.icon];
                return (
                  <Link key={item.href} href={item.href!} role="menuitem" data-active={item.href === "/app/proyectos" ? false : itemActive(pathname, item)} className="menu-item font-sans text-[14px]">
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })()
            ),
          )}
        </div>
      )}
    </div>
  );
}
