import Link from "next/link";
import type { ReactNode } from "react";

// Fila de lista reutilizable: título + meta opcional + acción opcional a la
// derecha. `min-w-0` + `truncate` evitan que texto largo (descripciones,
// emails) fuerce scroll horizontal en pantallas estrechas.
export function ListRow({
  href,
  title,
  meta,
  trailing,
  className,
}: {
  href?: string;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  const rowClass = `flex items-center justify-between gap-4 border-b border-line py-3 ${className ?? ""}`;
  const content = (
    <>
      <div className="min-w-0">
        <div className="truncate">{title}</div>
        {meta && <div className="truncate font-mono text-xs text-muted">{meta}</div>}
      </div>
      {trailing && (
        <div className="flex shrink-0 items-center gap-3">{trailing}</div>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`group ${rowClass} transition-colors hover:border-accent`}
      >
        {content}
      </Link>
    );
  }

  return <div className={rowClass}>{content}</div>;
}
