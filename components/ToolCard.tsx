import Link from "next/link";
import type { ReactNode } from "react";

export function ToolCard({
  href,
  icon,
  label,
}: {
  href?: string;
  icon: ReactNode;
  label: string;
}) {
  const iconBlock = <div className="h-8 w-8">{icon}</div>;

  if (!href) {
    return (
      <div className="flex aspect-square flex-col items-center justify-center gap-3 border border-line p-4 text-center opacity-40">
        {iconBlock}
        <span className="font-display text-sm font-bold uppercase">
          {label}
        </span>
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Próximamente
        </span>
      </div>
    );
  }

  return (
    <Link href={href} className="group block">
      <div className="flex aspect-square flex-col items-center justify-center gap-3 border border-line p-4 text-center transition-colors group-hover:border-accent group-hover:text-accent">
        {iconBlock}
        <span className="font-display text-sm font-bold uppercase">
          {label}
        </span>
      </div>
    </Link>
  );
}
