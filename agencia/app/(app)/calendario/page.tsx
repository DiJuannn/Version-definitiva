import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { pieceScope } from "@/lib/authz/scope";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { cx } from "@/components/ui/cx";
import { PIECE_STATUS } from "@/lib/domain/labels";
import { pieceRisk } from "@/lib/domain/piece-status";

export const metadata: Metadata = { title: "Calendario" };

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAYS = ["L", "M", "X", "J", "V", "S", "D"];

export default async function CalendarPage(props: PageProps<"/calendario">) {
  const me = await requireUser();
  const sp = await props.searchParams;
  const now = new Date();
  const m = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, mo] = m.split("-").map(Number);
  const first = new Date(y, mo - 1, 1);
  const last = new Date(y, mo, 0);
  const pieces = await db.piece.findMany({
    where: { AND: [pieceScope(me), { dueDate: { gte: first, lt: new Date(y, mo, 1) } }, { status: { notIn: ["CANCELLED"] } }] },
    select: { id: true, title: true, status: true, dueDate: true, project: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
  });
  const offset = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: Math.ceil((offset + last.getDate()) / 7) * 7 }, (_, i) => {
    const d = i - offset + 1;
    return d >= 1 && d <= last.getDate() ? d : null;
  });
  const byDay = new Map<number, typeof pieces>();
  for (const p of pieces) byDay.set(p.dueDate!.getDate(), [...(byDay.get(p.dueDate!.getDate()) ?? []), p]);
  const prev = `${mo === 1 ? y - 1 : y}-${String(mo === 1 ? 12 : mo - 1).padStart(2, "0")}`;
  const next = `${mo === 12 ? y + 1 : y}-${String(mo === 12 ? 1 : mo + 1).padStart(2, "0")}`;
  const isToday = (d: number) => d === now.getDate() && mo === now.getMonth() + 1 && y === now.getFullYear();
  return (
    <>
      <PageHeader
        title={`${MONTHS[mo - 1][0].toUpperCase()}${MONTHS[mo - 1].slice(1)} ${y}`}
        meta={<span>Fechas de entrega de piezas{me.role === "EDITOR" ? " asignadas a ti" : ""}.</span>}
        actions={
          <>
            <Link href={`/calendario?mes=${prev}`} className={buttonClass("secondary")} aria-label="Mes anterior"><ChevronLeft className="size-4" /></Link>
            <Link href="/calendario" className={buttonClass("secondary")}>Hoy</Link>
            <Link href={`/calendario?mes=${next}`} className={buttonClass("secondary")} aria-label="Mes siguiente"><ChevronRight className="size-4" /></Link>
          </>
        }
      />
      <div className="hidden overflow-hidden rounded-lg border border-line bg-surface md:block">
        <div className="grid grid-cols-7 border-b border-line bg-surface-2 text-center text-[12px] text-ink-3">
          {DAYS.map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => (
            <div key={i} className={cx("min-h-28 border-r border-b border-line p-1.5 [&:nth-child(7n)]:border-r-0", !d && "bg-surface-2/60")}>
              {d && (
                <>
                  <span className={cx("inline-grid size-6 place-items-center rounded-full text-[12px] tabular", isToday(d) ? "bg-ink font-semibold text-white" : "text-ink-3")}>{d}</span>
                  <ul className="mt-1 flex flex-col gap-1">
                    {(byDay.get(d) ?? []).map((p) => {
                      const risk = pieceRisk(p.status, p.dueDate);
                      return (
                        <li key={p.id}>
                          <Link
                            href={`/piezas/${p.id}`}
                            title={`${p.title} · ${p.project.name} · ${PIECE_STATUS[p.status].label}`}
                            className={cx(
                              "block truncate rounded px-1.5 py-0.5 text-[12px]",
                              risk === "late" ? "bg-[var(--tone-danger-bg)] text-[var(--tone-danger)]" : ["APPROVED", "FINAL_DELIVERY", "COMPLETED"].includes(p.status) ? "bg-[var(--tone-success-bg)] text-[var(--tone-success)]" : "bg-surface-2 text-ink hover:bg-line",
                            )}
                          >
                            {p.title}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {pieces.length ? (
          pieces.map((p) => (
            <li key={p.id}>
              <Link href={`/piezas/${p.id}`} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
                <span className="w-10 text-center font-mono text-sm tabular">{p.dueDate!.getDate()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.title}</span>
                  <span className="block truncate text-[12px] text-ink-3">{p.project.name} · {PIECE_STATUS[p.status].label}</span>
                </span>
              </Link>
            </li>
          ))
        ) : (
          <li className="text-sm text-ink-3">Sin entregas este mes.</li>
        )}
      </ul>
    </>
  );
}
