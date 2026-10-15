import Link from "next/link";

// Saltar entre herramientas sin perder la escena: lo que se ha desglosado en
// la 3 se planifica en la 3, y en el guion técnico se ve la 3.
export function SceneToolSwitch({
  projectId,
  sceneId,
  active,
}: {
  projectId: string;
  sceneId: string;
  active: "desglose" | "planos";
}) {
  const items = [
    { key: "desglose", label: "Desglose", href: `/app/${projectId}/desglose?escena=${sceneId}` },
    { key: "planos", label: "Planos", href: `/app/${projectId}/shot-list?escena=${sceneId}` },
    { key: "tecnico", label: "Guion técnico", href: `/app/${projectId}/shot-list?vista=tecnico#tec-${sceneId}` },
  ];
  return (
    <nav aria-label="Esta escena en otras herramientas" className="flex flex-wrap items-center gap-1.5 font-sans text-[13px]">
      <span className="mr-1 text-muted">Esta escena en</span>
      {items.map((it) =>
        it.key === active ? (
          <span key={it.key} aria-current="page" className="rounded-full bg-accent/15 px-3 py-1 font-semibold text-fg">
            {it.label}
          </span>
        ) : (
          <Link key={it.key} href={it.href} className="rounded-full border border-line px-3 py-1 text-muted transition-colors hover:border-accent hover:text-fg">
            {it.label}
          </Link>
        ),
      )}
    </nav>
  );
}
