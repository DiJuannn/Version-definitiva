"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClaquetaIcon } from "@/components/ToolIcons";
import { LinkPendingHint } from "@/components/LinkPendingHint";

// Acceso flotante a la claqueta digital, visible en cualquier pantalla de un
// proyecto activo (este componente cuelga del layout de [projectId], que no
// envuelve las páginas generales de la app). Se oculta en la propia pantalla
// de la claqueta: no tiene sentido un atajo hacia donde ya estás.
export function ClaquetaFab({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const claquetaHref = `/app/${projectId}/claqueta`;

  if (pathname === claquetaHref) return null;

  return (
    <Link
      href={claquetaHref}
      aria-label="Abrir claqueta digital"
      className="fixed right-5 bottom-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg shadow-black/50 transition-transform hover:scale-105 active:scale-95 print:hidden sm:right-6 sm:bottom-6"
    >
      <ClaquetaIcon className="h-6 w-6" />
      <LinkPendingHint className="absolute top-1.5 right-1.5" />
    </Link>
  );
}
