"use client";

import Link from "next/link";
import { formatEighths } from "@/lib/screenplay/story";
import { SCENE_STEPS } from "@/lib/scene-status";
import { useWorkspace } from "@/components/screenplay/workspace";
import { isNightTime } from "@/components/screenplay/StoryStrip";
import type { ScreenplayProduction } from "@/lib/actions/screenplay-production";

// Una página de guion es un minuto de pantalla; una jornada de corto rueda
// unas 4-5 páginas. Sirve de estimación mientras el proyecto no tiene plan.
const PAGES_PER_DAY = 4.5;

const fmtSeconds = (t: number) => (t < 60 ? `${t} s` : t % 60 ? `${Math.floor(t / 60)} min ${t % 60} s` : `${t / 60} min`);

function Split({ a, b, la, lb }: { a: number; b: number; la: string; lb: string }) {
  const t = a + b || 1;
  return (
    <div className="border-t border-[var(--line)] p-3 first:border-t-0 even:border-l">
      <p className="text-[22px] leading-none font-black tracking-tight">
        {a} <span className="text-muted">/</span> {b}
      </p>
      <p className="mt-1 text-[12px] text-muted">
        {la} / {lb}
      </p>
      <div aria-hidden className="mt-2 flex h-1 overflow-hidden rounded-full bg-black/10">
        <span className="bg-[#1c1b19]" style={{ width: `${(a / t) * 100}%` }} />
      </div>
    </div>
  );
}

// «Radiografía»: lo que cuesta rodar lo escrito, y lo que el proyecto ya
// sabe de la escena en la que está el cursor.
export function Radiography({ production }: { production: ScreenplayProduction | null }) {
  const { scenes, currentSid, linkedProject } = useWorkspace();
  const eighths = scenes.reduce((n, s) => n + s.eighths, 0);
  const seconds = Math.round((eighths / 8) * 60);
  const places = new Set(scenes.map((s) => s.place.trim().toLowerCase()).filter(Boolean));
  const ext = scenes.filter((s) => /^\s*(ext|exterior)/i.test(s.heading)).length;
  const night = scenes.filter((s) => isNightTime(s.time)).length;
  const realDays = production?.days.count ?? 0;
  const estDays = Math.max(1, Math.ceil(eighths / 8 / PAGES_PER_DAY));
  const current = scenes.find((s) => s.sid === currentSid) ?? null;
  const prod = current ? production?.scenes[current.sid] : undefined;

  return (
    <div className="space-y-5 font-[family-name:var(--font-archivo)]">
      <section>
        <p className="sp-label">Lo que cuesta rodarlo</p>
        <p className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-[44px] leading-none font-black tracking-tight">{Math.floor(seconds / 60)}</span>
          <span className="text-[15px] text-muted">min</span>
          <span className="ml-1 text-[44px] leading-none font-black tracking-tight">{String(seconds % 60).padStart(2, "0")}</span>
          <span className="text-[15px] text-muted">s</span>
        </p>
        <p className="mt-1 text-[12.5px] text-muted">en pantalla, estimados · {formatEighths(eighths)} páginas (1 pág. ≈ 1 min)</p>

        <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--line)] bg-white">
          <div className="p-3">
            <p className="text-[22px] leading-none font-black tracking-tight">
              {realDays || estDays} <span className="text-[13px] font-semibold text-muted">{(realDays || estDays) === 1 ? "día" : "días"}</span>
            </p>
            <p className="mt-1 text-[12px] text-muted">{realDays ? "de rodaje en el plan" : "de rodaje, estimados"}</p>
          </div>
          <div className="border-l border-[var(--line)] p-3">
            <p className="text-[22px] leading-none font-black tracking-tight">{places.size}</p>
            <p className="mt-1 text-[12px] text-muted">{places.size === 1 ? "localización" : "localizaciones"}</p>
          </div>
          <Split a={scenes.length - ext} b={ext} la="INT" lb="EXT" />
          <Split a={scenes.length - night} b={night} la="Día" lb="Noche" />
        </div>
      </section>

      {current && (
        <section>
          <p className="sp-label">Esta escena</p>
          <p className="mt-1.5 font-[family-name:var(--font-courier)] text-[13.5px] leading-snug font-bold uppercase">
            {current.number}. {current.heading || "Sin encabezado"}
          </p>
          <p className="mt-1 text-[12.5px] text-muted">
            {formatEighths(current.eighths)} pág. · ≈ {fmtSeconds(Math.max(1, Math.round((current.eighths / 8) * 60)))}
            {current.speakers.length > 0 && ` · hablan ${current.speakers.slice(0, 4).join(", ")}`}
          </p>

          {prod ? (
            <>
              <ul className="mt-3 grid grid-cols-2 gap-1.5 text-[12.5px]">
                {SCENE_STEPS.map((step) => (
                  <li key={step.key} className={`flex items-center gap-1.5 ${prod.status[step.key] ? "" : "text-muted"}`}>
                    <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: prod.status[step.key] ? step.color : "transparent", boxShadow: "inset 0 0 0 1px rgba(28,27,25,0.45)" }} />
                    {step.label}
                    {step.key === "planned" && prod.shots > 0 && ` · ${prod.shots}`}
                    {step.key === "scheduled" && prod.days.length > 0 && ` · ${prod.days.join(", ")}`}
                  </li>
                ))}
              </ul>
              <p className="sp-label mt-4">Elementos de producción</p>
              {prod.breakdown.length > 0 ? (
                <ul className="mt-1.5 divide-y divide-[var(--line)] rounded-lg border border-[var(--line)] bg-white">
                  {prod.breakdown.map((b) => (
                    <li key={b.category + b.name} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                      <span>{b.name}</span>
                      <span className="text-[11.5px] text-muted">{b.category}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[13px] leading-snug text-muted">Aún sin desglose: lo que haga falta (atrezzo, vestuario, vehículos…) se marca en el Desglose.</p>
              )}
              <Link
                href={`/app/${production!.projectId}/desglose?escena=${prod.sceneId}`}
                className="mt-3 inline-block text-[13px] font-semibold text-[var(--accent)] hover:underline"
              >
                Abrir en el desglose →
              </Link>
            </>
          ) : linkedProject ? (
            <p className="mt-3 text-[13px] leading-snug text-muted">
              Esta escena aún no está en {linkedProject.name}. Pasa sola al proyecto unos segundos después de escribir su encabezado.
            </p>
          ) : (
            <p className="mt-3 text-[13px] leading-snug text-muted">
              Vincula el guion a un proyecto (en Ajustes del guion) para ver aquí su desglose, sus planos y su día de rodaje.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
