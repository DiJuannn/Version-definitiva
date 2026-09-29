import type { UserActor } from "@/lib/authz/actor";

export type NavItem = { href: string; label: string; icon: string };
export type NavGroup = { label?: string; items: NavItem[] };

export function navFor(u: UserActor, opts: { clientRequests: boolean }): NavGroup[] {
  switch (u.role) {
    case "ADMIN":
      return [
        { items: [
          { href: "/inicio", label: "Inicio", icon: "home" },
          { href: "/proyectos", label: "Proyectos", icon: "folder" },
          { href: "/calendario", label: "Calendario", icon: "calendar" },
        ] },
        { label: "Agencia", items: [
          { href: "/equipo", label: "Equipo", icon: "users" },
          { href: "/clientes", label: "Clientes", icon: "briefcase" },
          { href: "/finanzas", label: "Finanzas", icon: "coins" },
        ] },
        { label: "Sistema", items: [
          { href: "/ajustes", label: "Ajustes y usuarios", icon: "settings" },
          { href: "/auditoria", label: "Auditoría", icon: "scroll" },
        ] },
      ];
    case "COORDINATOR":
      return [
        { items: [
          { href: "/inicio", label: "Inicio", icon: "home" },
          { href: "/proyectos", label: "Proyectos", icon: "folder" },
          { href: "/calendario", label: "Calendario", icon: "calendar" },
        ] },
        { label: "Agencia", items: [
          { href: "/equipo", label: "Equipo", icon: "users" },
          { href: "/clientes", label: "Clientes", icon: "briefcase" },
        ] },
      ];
    case "EDITOR":
      return [
        { items: [
          { href: "/inicio", label: "Mi trabajo", icon: "home" },
          { href: "/proyectos", label: "Proyectos", icon: "folder" },
          { href: "/calendario", label: "Calendario", icon: "calendar" },
          ...(u.canViewOwnPay ? [{ href: "/mis-pagos", label: "Mis pagos", icon: "coins" }] : []),
        ] },
      ];
    case "CLIENT":
      return [
        { items: [
          { href: "/inicio", label: "Inicio", icon: "home" },
          { href: "/proyectos", label: "Proyectos", icon: "folder" },
          ...(opts.clientRequests ? [{ href: "/proyectos/solicitar", label: "Nueva solicitud", icon: "plus" }] : []),
        ] },
      ];
  }
}
