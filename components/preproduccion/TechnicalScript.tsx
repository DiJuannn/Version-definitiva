import Link from "next/link";
import { SceneSlug } from "@/components/preproduccion/SceneSlug";
import { SHOT_SIZE_NAMES, ShotFrame, shotSizeKind } from "@/components/preproduccion/ShotFrame";
import type { SceneText } from "@/lib/scene-text";
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
  done: boolean;
};

type Scene = {
  id: string;
  number: string;
  intExt: IntExt;
  dayPart: DayPart;
  location: { name: string } | null;
  shots: Shot[];
};

// El guion técnico: el guion entero, escena a escena, con el texto a la
// izquierda (como se escribió) y a la derecha cómo se rueda, plano a plano.
// Se lee de corrido y se imprime tal cual.
export function TechnicalScript({
  projectId,
  scenes,
  texts,
}: {
  projectId: string;
  scenes: Scene[];
  texts: Map<string, SceneText>;
}) {
  return (
    <div className="mt-8 space-y-6">
      {scenes.map((scene) => {
        const text = texts.get(scene.id);
        return (
          <article
            key={scene.id}
            id={`tec-${scene.id}`}
            className="paper grid scroll-mt-32 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] print:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
          >
            <div className="print-keep col-span-full flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line px-6 py-3.5">
              <span className="font-[family-name:var(--font-courier)] text-[15px] font-bold">{scene.number}.</span>
              <SceneSlug intExt={scene.intExt} dayPart={scene.dayPart} location={scene.location?.name} className="text-[14.5px]" />
              <span className="ml-auto font-sans text-[12.5px] text-muted">
                {scene.shots.length === 0 ? (
                  <Link href={`/app/${projectId}/shot-list?escena=${scene.id}`} className="font-semibold text-warn hover:underline print-hide">
                    Sin planos · planificar →
                  </Link>
                ) : (
                  `${scene.shots.length} plano${scene.shots.length === 1 ? "" : "s"}`
                )}
              </span>
            </div>

            {/* El texto de la escena, en Courier como en el guion. */}
            <div className="border-line px-6 py-5 font-[family-name:var(--font-courier)] text-[13px] leading-[1.55] lg:border-r print:border-r">
              {text && text.blocks.length > 0 ? (
                text.blocks.map((b, i) => (
                  <p
                    key={i}
                    className={`whitespace-pre-wrap ${
                      b.type === "character"
                        ? "mt-3 ml-[30%] uppercase"
                        : b.type === "dialogue"
                          ? "mx-[12%]"
                          : b.type === "parenthetical"
                            ? "ml-[22%]"
                            : b.type === "transition"
                              ? "mt-3 text-right uppercase"
                              : "mt-3 first:mt-0"
                    }`}
                  >
                    {b.text}
                  </p>
                ))
              ) : (
                <p className="font-sans text-sm text-muted">Esta escena no tiene texto todavía.</p>
              )}
            </div>

            {/* Cómo se rueda. */}
            <div className="border-t border-line lg:border-t-0 print:border-t-0">
              {scene.shots.length === 0 ? (
                <p className="px-6 py-5 font-sans text-sm text-muted">Todavía no hay planos para esta escena.</p>
              ) : (
                <table className="w-full border-collapse font-sans text-[13px]">
                  <thead className="sr-only">
                    <tr>
                      <th>Plano</th>
                      <th>Encuadre</th>
                      <th>Descripción</th>
                      <th>Cámara</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {scene.shots.map((sh) => {
                      const kind = shotSizeKind(sh.shotSize);
                      const camera = [sh.angle, sh.movement, sh.lens].filter(Boolean).join(" · ");
                      return (
                        <tr key={sh.id} className="align-top">
                          <td className="w-14 py-3 pl-6 font-mono text-[12.5px] font-semibold tabular-nums">
                            <Link href={`/app/${projectId}/shot-list/${sh.id}`} className="hover:text-accent">
                              {scene.number}.{sh.number}
                            </Link>
                            {sh.done && <span className="mt-1 block text-[10px] font-normal text-success">✓ rodado</span>}
                          </td>
                          <td className="w-20 py-3 pr-3">
                            <ShotFrame size={sh.shotSize} className="h-9 w-16" />
                          </td>
                          <td className="py-3 pr-6">
                            <p className="font-semibold">
                              {kind ? SHOT_SIZE_NAMES[kind] : (sh.shotSize ?? "Sin tamaño")}
                              {sh.durationSec ? <span className="ml-2 font-normal text-muted">{sh.durationSec}″</span> : null}
                            </p>
                            {sh.description && <p className="mt-0.5 leading-snug text-fg/80">{sh.description}</p>}
                            {(camera || sh.audio) && (
                              <p className="mt-1 text-[12px] text-muted">
                                {camera}
                                {sh.audio ? `${camera ? " · " : ""}Sonido: ${sh.audio}` : ""}
                              </p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
