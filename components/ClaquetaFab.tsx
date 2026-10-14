"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClaquetaIcon } from "@/components/ToolIcons";
import { LinkPendingHint } from "@/components/LinkPendingHint";

// Acceso flotante a la claqueta digital, visible en cualquier pantalla de un
// proyecto activo (este componente cuelga del layout de [projectId], que no
// envuelve las páginas generales de la app). Se oculta en la propia pantalla
// de la claqueta: no tiene sentido un atajo hacia donde ya estás, y en el
// moodboard, donde taparía el lienzo. Solo en móvil y tableta: en escritorio
// la claqueta está en el menú del proyecto y el botón tapaba la columna de la
// derecha de las tablas (estado de los planos, actor de cada personaje…).
export function ClaquetaFab({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const claquetaHref = `/app/${projectId}/claqueta`;

  if (pathname === claquetaHref) return null;
  // En el moodboard el lienzo ocupa la pantalla y el botón taparía su esquina
  // (zoom y mapa del tablero): ahí la claqueta queda en el menú del proyecto.
  if (pathname === `/app/${projectId}/moodboard`) return null;

  return (
    <Link
      href={claquetaHref}
      aria-label="Abrir claqueta digital"
      className="fixed right-5 bottom-5 z-40 flex h-14 w-14 lg:hidden items-center justify-center rounded-full bg-accent text-bg shadow-lg shadow-accent/30 ring-1 ring-fg/10 transition-transform hover:scale-105 active:scale-95 print:hidden sm:right-6 sm:bottom-6"
    >
      <ClaquetaIcon className="h-6 w-6" />
      <LinkPendingHint className="absolute top-1.5 right-1.5" />
    </Link>
  );
}
