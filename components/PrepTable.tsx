import Link from "next/link";
import { SceneChip } from "@/components/ScenePeek";
import { sceneCells, type ReadinessScene } from "@/lib/project-readiness";

const CELL = "inline-grid h-7 min-w-[3rem] place-items-center rounded-[var(--r-xs)] px-1.5 font-mono text-[12px] transition-colors";
const OK = `${CELL} bg-[color-mix(in_srgb,var(--phase-4)_15%,transparent)] text-[color-mix(in_srgb,var(--phase-4)_80%,white)] hover:bg-[color-mix(in_srgb,var(--phase-4)_26%,transparent)]`;
const MID = `${CELL} bg-[color-mix(in_srgb,var(--phase-2)_15%,transparent)] text-[var(--phase-2)] hover:bg-[color-mix(in_srgb,var(--phase-2)_26%,transparent)]`;
const NO = `${CELL} border border-dashed border-ink-3 text-muted hover:border-fg/40 hover:text-fg`;

// La tabla de la Mesa de preparación: una fila por escena y, en cada casilla,
// lo que tiene (verde), lo que tiene a medias (amarillo) o lo que falta
// (punteado). Cada casilla lleva a la herramienta, en esa escena si se puede.
export function PrepTable({ projectId, scenes }: { projectId: string; scenes: ReadinessScene[] }) {
  const base = `/app/${projectId}`;
  const cols = ["Desglose", "Planos", "Storyboard", "Reparto", "Lugar", "Día"];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] font-sans text-[13.5px]">
        <thead>
          <tr className="border-b border-line font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">
            <th className="py-3 pl-5 text-left font-normal">Escena</th>
            {cols.map((c) => (
              <th key={c} className="px-1.5 py-3 font-normal">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scenes.map((s) => {
            const c = sceneCells(s);
            return (
              <tr key={s.id} className="border-b border-line last:border-b-0 hover:bg-ink-2/50">
                <td className="max-w-[18rem] py-2 pl-5">
                  <span className="flex items-center gap-2.5">
                    <SceneChip sceneId={s.id} number={s.number} intExt={s.intExt} dayPart={s.dayPart} className="font-mono text-[13px] font-semibold" />
                    <span className="truncate font-[family-name:var(--font-courier)] text-[12.5px] font-bold">{s.slug}</span>
                  </span>
                </td>
                <td className="px-1.5 py-2 text-center">
                  <Link href={`${base}/desglose?escena=${s.id}`} title="Desglose" className={c.breakdown ? OK : NO}>
                    {s.breakdown || "—"}
                  </Link>
                </td>
                <td className="px-1.5 py-2 text-center">
                  <Link href={`${base}/shot-list?escena=${s.id}`} title="Planos" className={c.shots ? OK : NO}>
                    {s.shots || "—"}
                  </Link>
                </td>
                <td className="px-1.5 py-2 text-center">
                  <Link href={`${base}/storyboard`} title="Storyboard" className={c.board ? OK : s.boarded > 0 ? MID : NO}>
                    {s.shots ? `${s.boarded}/${s.shots}` : "—"}
                  </Link>
                </td>
                <td className="px-1.5 py-2 text-center">
                  <Link href={`${base}/personajes`} title="Reparto" className={s.cast.total === 0 ? NO : c.cast ? OK : MID}>
                    {s.cast.total ? `${s.cast.withActor}/${s.cast.total}` : "—"}
                  </Link>
                </td>
                <td className="px-1.5 py-2 text-center">
                  <Link href={`${base}/localizaciones`} title={s.location ?? "Sin localización"} className={c.location ? OK : NO}>
                    {c.location ? "✓" : "—"}
                  </Link>
                </td>
                <td className="px-1.5 py-2 text-center">
                  <Link href={`${base}/plan-de-rodaje`} title="Plan de rodaje" className={c.day ? OK : s.scheduled > 0 ? MID : NO}>
                    {c.day ? s.days.map((d) => `D${d}`).join("·") || "✓" : s.shots && s.scheduled ? `${s.scheduled}/${s.shots}` : "—"}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
