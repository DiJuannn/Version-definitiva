import Link from "next/link";
import { AlertTriangle, MessageSquareWarning } from "lucide-react";
import type { PieceStatus, Priority, VersionStatus } from "@prisma/client";
import { Chip, Tape } from "@/components/ui/chip";
import { cx } from "@/components/ui/cx";
import { PIECE_STATUS, PRIORITY } from "@/lib/domain/labels";
import { pieceRisk } from "@/lib/domain/piece-status";
import { fmtDue } from "@/lib/format";

export type PieceRowData = {
  id: string;
  title: string;
  status: PieceStatus;
  priority?: Priority;
  dueDate: Date | null;
  editor?: { name: string } | null;
  project?: { id: string; name: string; client?: { name: string } };
  currentVersion?: { id: string; number: number; status: VersionStatus } | null;
  blockers?: { id: string; reason: string }[];
  _count?: { corrections: number };
};

export function PieceRow({ p, href, showProject = true, action }: { p: PieceRowData; href?: string; showProject?: boolean; action?: React.ReactNode }) {
  const risk = pieceRisk(p.status, p.dueDate);
  const s = PIECE_STATUS[p.status];
  return (
    <li className="group relative flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={href ?? `/piezas/${p.id}`} className="truncate text-sm font-medium text-ink after:absolute after:inset-0 hover:underline">
            {p.title}
          </Link>
          {p.priority && (p.priority === "HIGH" || p.priority === "URGENT") && (
            <Chip tone={PRIORITY[p.priority].tone} dot={false} className="h-5 text-[11px]">
              {PRIORITY[p.priority].label}
            </Chip>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-3">
          {showProject && p.project && (
            <span className="truncate">
              {p.project.client?.name ? `${p.project.client.name} · ` : ""}
              {p.project.name}
            </span>
          )}
          {p.editor && <span>· {p.editor.name}</span>}
          {p.blockers && p.blockers.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[var(--tone-danger)]">
              <AlertTriangle className="size-3.5" /> {p.blockers[0].reason}
            </span>
          )}
          {p._count && p._count.corrections > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquareWarning className="size-3.5" /> {p._count.corrections} correcciones abiertas
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {p.currentVersion && <Tape variant="paper">V{p.currentVersion.number}</Tape>}
        <Chip tone={s.tone}>{s.label}</Chip>
        <span
          className={cx(
            "w-32 text-right text-[13px] tabular",
            risk === "late" ? "font-medium text-[var(--tone-danger)]" : risk === "at_risk" ? "text-[var(--tone-attention)]" : "text-ink-3",
          )}
        >
          {fmtDue(p.dueDate)}
        </span>
        {action && <div className="relative z-10">{action}</div>}
      </div>
    </li>
  );
}

export function PieceList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-line">{children}</ul>;
}
