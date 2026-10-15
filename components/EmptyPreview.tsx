import { ShotFrame } from "@/components/preproduccion/ShotFrame";
import { stripColor } from "@/components/preproduccion/palette";

export type EmptyPreviewKind = "escenas" | "jornadas" | "planos" | "hoja" | "tomas" | "creditos";

// Muestra de cómo se verá la herramienta cuando tenga contenido: datos de
// ejemplo, apagados y sin interacción, con la etiqueta «Así se verá».
// Un vacío enseña el destino, no solo el primer paso.
const SCENES = [
  { n: "1", ie: "EXT" as const, dp: "DAY" as const, slug: "EXT. AZOTEA — DÍA", cast: "MARA, LEO" },
  { n: "2", ie: "INT" as const, dp: "DAY" as const, slug: "INT. COCINA — DÍA", cast: "MARA" },
  { n: "3", ie: "INT" as const, dp: "NIGHT" as const, slug: "INT. COCHE — NOCHE", cast: "LEO, TAXISTA" },
];

export function EmptyPreview({ kind }: { kind: EmptyPreviewKind }) {
  return (
    <div aria-hidden className="relative mx-auto mt-8 max-w-2xl select-none">
      <span className="absolute -top-2.5 left-4 z-10 rounded-full bg-bg px-2.5 py-0.5 font-mono text-[10px] tracking-[0.16em] text-muted uppercase ring-1 ring-line">
        Así se verá
      </span>
      <div className="pointer-events-none overflow-hidden rounded-xl border border-dashed border-line p-5 opacity-55 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
        {kind === "escenas" && (
          <ul className="space-y-2.5 text-left">
            {SCENES.map((s) => (
              <li key={s.n} className="flex items-center gap-3 rounded-md bg-fg/[0.04] py-2.5 pr-3">
                <span className="h-8 w-1.5 rounded-r" style={{ background: stripColor(s.ie, s.dp) }} />
                <span className="poster-sub w-6 text-[22px] leading-none">{s.n}</span>
                <span className="font-mono text-[12px] font-bold">{s.slug}</span>
                <span className="ml-auto font-mono text-[10px] text-muted">{s.cast}</span>
              </li>
            ))}
          </ul>
        )}
        {kind === "jornadas" && (
          <div className="grid grid-cols-3 gap-3 text-left">
            {["sáb 7", "dom 8", "lun 9"].map((d, i) => (
              <div key={d} className="rounded-md bg-fg/[0.04] p-3">
                <p className="font-sans text-[13px] font-semibold">
                  Día {i + 1} · {d}
                </p>
                <p className="font-sans text-[11.5px] text-muted">{["Azotea · 8 planos", "Cocina · 6 planos", "Coche · 5 planos"][i]}</p>
                <div className="mt-3 space-y-1.5">
                  {SCENES.slice(0, 3 - (i % 2)).map((s) => (
                    <span key={s.n} className="block h-2.5 rounded-sm" style={{ background: stripColor(s.ie, s.dp), opacity: 0.8 }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {kind === "planos" && (
          <ul className="space-y-2 text-left">
            {[
              ["PG", "1.1", "La azotea al amanecer; Mara entra en cuadro."],
              ["PM", "1.2", "Mara mira la ciudad."],
              ["PP", "1.3", "Leo, desde la puerta, la observa."],
              ["PD", "1.4", "El billete arrugado en su mano."],
            ].map(([size, n, d]) => (
              <li key={n} className="flex items-center gap-3">
                <ShotFrame size={size} className="h-9 w-16 shrink-0" />
                <span className="w-8 font-mono text-[12px] font-semibold">{n}</span>
                <span className="font-sans text-[13px]">{d}</span>
              </li>
            ))}
          </ul>
        )}
        {kind === "hoja" && (
          <div className="rounded-md bg-fg/[0.04] p-4 text-left">
            <div className="flex items-baseline justify-between">
              <p className="poster-sub text-[24px]">Día 1 · sábado 7</p>
              <p className="font-mono text-[12px]">Citación 07:30</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 font-sans text-[12px]">
              <p>
                <span className="block text-muted">Dónde</span>Azotea, c/ Mayor 12
              </p>
              <p>
                <span className="block text-muted">Escenas</span>1 · 4 · 7
              </p>
              <p>
                <span className="block text-muted">Reparto</span>MARA 08:00 · LEO 09:15
              </p>
            </div>
          </div>
        )}
        {kind === "tomas" && (
          <ul className="space-y-1.5 text-left font-mono text-[12px]">
            {[
              ["1.1", "T1", "10:42", "foco tarde", false],
              ["1.1", "T2", "10:47", "", true],
              ["1.2", "T1", "11:05", "ruido avión", false],
              ["1.2", "T2", "11:09", "", true],
            ].map(([p, t, h, note, good], i) => (
              <li key={i} className="flex items-center gap-4 rounded bg-fg/[0.04] px-3 py-2">
                <span className="w-8 font-semibold">{p as string}</span>
                <span className={good ? "rounded-full px-1.5 ring-2 ring-success" : "px-1.5"}>{t as string}</span>
                <span className="text-muted">{h as string}</span>
                <span className="font-sans text-muted">{note as string}</span>
                {good && <span className="ml-auto font-sans text-success">buena</span>}
              </li>
            ))}
          </ul>
        )}
        {kind === "creditos" && (
          <div className="space-y-3 text-center font-sans text-[12px]">
            {[
              ["Dirección", "Nombre Apellido"],
              ["Reparto", "Mara — Actriz · Leo — Actor"],
              ["Dirección de fotografía", "Nombre Apellido"],
            ].map(([role, name]) => (
              <p key={role}>
                <span className="block font-mono text-[10px] tracking-[0.16em] text-muted uppercase">{role}</span>
                {name}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
