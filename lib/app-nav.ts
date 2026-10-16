import type { NavItem } from "@/components/DashboardNav";

// Las secciones de toda la organización. Fuera de un proyecto van como
// pestañas en la barra de arriba; dentro de un proyecto, en el botón Menú
// (así la cabecera del proyecto es una sola barra).
export const APP_NAV: NavItem[] = [
  { href: "/app", label: "Inicio", icon: "home" },
  { href: "/app/proyectos", label: "Proyectos", icon: "projects" },
  { href: "/app/guiones", label: "Guiones", icon: "pen" },
  { href: "/app/calendario", label: "Agenda", icon: "calendar", also: ["/app/tareas"] },
  {
    label: "Recursos",
    icon: "people",
    children: [
      { href: "/app/equipo", label: "Equipo", icon: "people" },
      { href: "/app/localizaciones", label: "Localizaciones", icon: "location" },
      { href: "/app/inventario", label: "Material", icon: "box" },
      { href: "/app/vehiculos", label: "Vehículos", icon: "vehicle" },
    ],
  },
];

// Enlaces del menú de la cuenta (avatar) según el papel de cada uno.
export function accountLinks(profile: { role: string; organization: { isPlatformOwner: boolean } } | null) {
  const admin = profile?.role === "ADMIN";
  return [
    ...(admin ? [{ href: "/app/organizacion", label: "Organización y plan" }] : []),
    ...(admin && profile?.organization.isPlatformOwner ? [{ href: "/admin", label: "Editor web" }] : []),
  ];
}
