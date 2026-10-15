import Link from "next/link";
import { SceneSlug } from "@/components/preproduccion/SceneSlug";
import { ShotFrame, shotSizeKind } from "@/components/preproduccion/ShotFrame";
import type { DayPart, IntExt } from "@/lib/generated/prisma";

type Shot = {
  id: string;
  number: string;
  shotSize: string | null;
  angle: string | null;
  movement: string | null;
  lens: string | null;
  durationSec: number | null;
  description: string | null;
  audio: string | null;
  notes: string | null;
  done: boolean;
  storyboard: { imageUrl: string | null }[];
};

export type TechnicalScene = {
  id: string;
  number: string;
  intExt: IntExt;
  dayPart: DayPart;
  location: { name: string } | null;
  summary: string | null;
  characters: string[];
  shots: Shot[];
};

// Segundos → 0:07, 1:24…
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// El audio de un plano: si empieza por «NOMBRE:» es diálogo y el nombre va
// en versalitas, como en el guion.
function AudioCell({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        const m = /^([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ .'-]{1,30}):\s*(.*)$/.exec(line);
        return (
          <p key={i} className={i ? "mt-1" : ""}>
            {m ? (
              <>
                <b className="font-[family-name:var(--font-courier)] text-[11.5px] font-bold">{m[1]}</b>{" "}
                <span className="font-[family-name:var(--font-courier)] text-[12px]">{m[2]}</span>
              </>
            ) : (
              line
            )}
          </p>
        );
      })}
    </>
  );
}

// El guion técnico tal como se usa en un rodaje: una tabla plano a plano,
// agrupada por escenas. Cada fila dice qué se ve (imagen), con qué encuadre,
// cómo está la cámara, qué se oye (diálogo, efectos, música) y cuánto dura,
// con el tiempo acumulado de la película.
export function TechnicalScript({ projectId, scenes }: { projectId: string; scenes: TechnicalScene[] }) {
  let elapsed = 0;
  const total = scenes.reduce((n, s) => n + s.shots.reduce((m, sh) => m + (sh.durationSec ?? 0), 0), 0);
  const shotCount = scenes.reduce((n, s) => n + s.shots.length, 0);
  const withoutTime = scenes.reduce((n, s) => n + s.shots.filter((sh) => !sh.durationSec).length, 0);

  const th = "px-3 py-2.5 text-left font-mono text-[10px] font-normal tracking-[0.14em] text-muted uppercase";

  return (
    <>
      <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-2 font-sans text-sm">
        <div className="flex items-baseline gap-2">
          <dd className="font-display text-2xl font-black tabular-nums">{scenes.length}</dd>
          <dt className="text-muted">escenas</dt>
        </div>
        <div className="flex items-baseline gap-2">
          <dd className="font-display text-2xl font-black tabular-nums">{shotCount}</dd>
          <dt className="text-muted">planos</dt>
        </div>
        <div className="flex items-baseline gap-2">
          <dd className="font-display text-2xl font-black tabular-nums">{clock(total)}</dd>
          <dt className="text-muted">
            de duración{withoutTime > 0 && ` (faltan ${withoutTime} plano${withoutTime === 1 ? "" : "s"} por cronometrar)`}
          </dt>
        </div>
      </dl>

      <div className="paper mt-6 overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[980px] border-collapse font-sans text-[13px] print:min-w-0 print:text-[10.5px]">
          <thead className="border-b-2 border-fg/70">
            <tr>
              <th className={`${th} w-14 pl-5`}>Plano</th>
              <th className={`${th} w-24`}>Encuadre</th>
              <th className={th}>Imagen</th>
              <th className={`${th} w-36`}>Cámara</th>
              <th className={`${th} w-[26%]`}>Audio</th>
              <th className={`${th} w-14 text-right`}>Dur.</th>
              <th className={`${th} w-16 pr-5 text-right`}>Acum.</th>
            </tr>
          </thead>
          {scenes.map((scene) => {
            const sceneTime = scene.shots.reduce((m, sh) => m + (sh.durationSec ?? 0), 0);
            return (
              <tbody key={scene.id} id={`tec-${scene.id}`} className="scroll-mt-32 break-inside-avoid-page">
                {/* La escena, como cabecera de su bloque de planos. */}
                <tr className="border-b border-line bg-fg/[0.045]">
                  <td colSpan={7} className="px-5 pt-4 pb-3">
                    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-[family-name:var(--font-courier)] text-[14px] font-bold">{scene.number}.</span>
                      <SceneSlug intExt={scene.intExt} dayPart={scene.dayPart} location={scene.location?.name} className="text-[14px]" />
                      <span className="ml-auto font-mono text-[11px] text-muted tabular-nums">
                        {scene.shots.length} plano{scene.shots.length === 1 ? "" : "s"}
                        {sceneTime > 0 && ` · ${clock(sceneTime)}`}
                      </span>
                    </p>
                    {(scene.summary || scene.characters.length > 0) && (
                      <p className="mt-1 line-clamp-2 max-w-4xl text-[12.5px] leading-snug text-muted">
                        {scene.summary}
                        {scene.characters.length > 0 && (
                          <span className="text-fg/70">
                            {scene.summary ? " · " : ""}
                            {scene.characters.join(", ")}
                          </span>
                        )}
                      </p>
                    )}
                  </td>
                </tr>
                {scene.shots.length === 0 ? (
                  <tr className="border-b border-line">
                    <td colSpan={7} className="px-5 py-4 text-muted">
                      Sin planos todavía.{" "}
                      <Link href={`/app/${projectId}/shot-list?escena=${scene.id}`} className="font-semibold text-accent hover:underline print:hidden">
                        Planificar la escena {scene.number} →
                      </Link>
                    </td>
                  </tr>
                ) : (
                  scene.shots.map((sh) => {
                    elapsed += sh.durationSec ?? 0;
                    const kind = shotSizeKind(sh.shotSize);
                    const frame = sh.storyboard[0]?.imageUrl;
                    return (
                      <tr key={sh.id} className="border-b border-line align-top break-inside-avoid">
                        <td className="py-3 pl-5 font-mono text-[12.5px] font-semibold tabular-nums">
                          <Link href={`/app/${projectId}/shot-list/${sh.id}`} className="hover:text-accent">
                            {scene.number}.{sh.number}
                          </Link>
                          {sh.done && <span className="mt-1 block text-[10px] font-normal text-success">✓ rodado</span>}
                        </td>
                        <td className="px-3 py-3">
                          {frame ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={frame} alt={`Viñeta del plano ${scene.number}.${sh.number}`} className="aspect-video w-[68px] rounded-[2px] object-cover" />
                          ) : (
                            <ShotFrame size={sh.shotSize} className="h-[38px] w-[68px]" />
                          )}
                          <span className="mt-1 block font-mono text-[11px] font-semibold">{kind ?? sh.shotSize ?? "—"}</span>
                        </td>
                        <td className="px-3 py-3 leading-snug">
                          {sh.description ?? <span className="text-muted">Sin descripción</span>}
                          {sh.notes && <span className="mt-1 block text-[12px] text-muted">{sh.notes}</span>}
                        </td>
                        <td className="px-3 py-3 text-[12.5px] leading-snug">
                          {[sh.angle, sh.movement, sh.lens].filter(Boolean).map((t, i) => (
                            <span key={i} className="block">
                              {t}
                            </span>
                          ))}
                          {!sh.angle && !sh.movement && !sh.lens && <span className="text-muted">—</span>}
                        </td>
                        <td className="px-3 py-3 leading-snug">
                          {sh.audio ? <AudioCell text={sh.audio} /> : <span className="text-muted">—</span>}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-[12px] tabular-nums">
                          {sh.durationSec ? clock(sh.durationSec) : <span className="text-muted">—</span>}
                        </td>
                        <td className="py-3 pr-5 text-right font-mono text-[12px] text-muted tabular-nums">{clock(elapsed)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            );
          })}
        </table>
      </div>
    </>
  );
}
