import Link from "next/link";
import type { ReactNode } from "react";
import { LinkPendingHint } from "@/components/LinkPendingHint";

export function ToolCard({
  href,
  icon,
  label,
  description,
}: {
  href?: string;
  icon: ReactNode;
  label: string;
  description?: string;
}) {
  const iconBlock = (
    <div className="h-8 w-8 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110">
      {icon}
    </div>
  );

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
      <div className="relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden border border-line p-4 text-center transition duration-300 group-hover:border-accent group-hover:text-accent group-active:scale-[0.97]">
        {iconBlock}
        <span className="flex items-center font-display text-sm font-bold uppercase">
          {label}
          <LinkPendingHint />
        </span>
        {description && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/95 p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <p className="font-mono text-[11px] leading-relaxed text-muted">
              {description}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}
