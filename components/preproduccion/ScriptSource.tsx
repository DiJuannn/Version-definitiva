import Link from "next/link";
import { courierPrime } from "@/lib/screenplay/font";
import { COVER_SHADOW } from "@/components/screenplay/cover-shadow";
import { SyncScenesButton } from "@/components/preproduccion/SyncScenesButton";
import { SubmitButton } from "@/components/SubmitButton";
import { importUploadedScriptToGuiones, linkScriptToProject, syncProjectScriptScenes, writeProjectScript } from "@/lib/actions/screenplays";
import { ActionButtonForm } from "@/components/ActionButtonForm";
import type { ScenePlan } from "@/lib/screenplay-scenes";

const relative = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
function ago(date: Date) {
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (minutes > -60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

// Un guion de clase puede tener siete autores: en la línea van los dos
// primeros y «y N más».
function shortAuthor(author: string) {
  const names = author.split(/\s*(?:,|\by\b|&)\s*/).filter(Boolean);
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} y ${names.length - 2} más` : author;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Portada en miniatura, la misma que en la mesa de Guiones.
function Cover({ href, title, author }: { href: string; title: string; author: string | null }) {
  return (
    <Link href={href} className={`sp-cover group block w-28 shrink-0 ${courierPrime.variable}`} aria-label={`Abrir «${title}» en Guiones`}>
      <span className={`sp-cover-sheet flex flex-col px-[10%] pt-[32%] pb-[8%] text-center text-[#1c1b19] ${COVER_SHADOW}`}>
        <span className="line-clamp-3 font-[family-name:var(--font-courier)] text-[9px] leading-tight font-bold uppercase underline underline-offset-2">
          {title}
        </span>
        {author && (
          <span className="mt-[14%] line-clamp-2 font-[family-name:var(--font-courier)] text-[7px] text-[#4a4842]">
            escrito por {author}
          </span>
        )}
      </span>
    </Link>
  );
}

// Lo de arriba de la herramienta Guion: de dónde salen las escenas. Si el
// proyecto tiene su guion en Guiones, se ve aquí con su estado frente a
// producción; si no, las formas de traerlo.
export function ScriptSource({
  projectId,
  plan,
  candidates,
  hasScenes,
  uploadedFile = null,
}: {
  projectId: string;
  plan: ScenePlan | null;
  // El último guion subido con el sistema de antes (PDF/Word), si lo hay.
  uploadedFile?: { name: string; uploadedAt: Date } | null;
  // Guiones de la organización sin proyecto, para vincular uno.
  candidates: { id: string; title: string }[];
  hasScenes: boolean;
}) {
  const sync = syncProjectScriptScenes.bind(null, projectId);

  if (plan) {
    const { screenplay, added, changed, gone, adopting } = plan;
    // Recién pasado a Guiones: las escenas de aquí aún no están unidas a las del guion.
    const firstLink = adopting > 0 && adopting === changed.length;
    const href = `/app/guiones/${screenplay.id}`;
    const pending = added.length + changed.length;
    return (
      <section aria-labelledby="guion-fuente" className="mt-9 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        <Cover href={href} title={screenplay.title} author={screenplay.author} />
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-accent">El guion · se escribe en Guiones</p>
          <h2 id="guion-fuente" className="mt-1.5 font-display text-2xl font-black tracking-tight">
            {screenplay.title}
          </h2>
          <p className="mt-1 font-sans text-sm text-muted">
            {[
              screenplay.author ? `de ${shortAuthor(screenplay.author)}` : null,
              plural(screenplay.pageCount, "página", "páginas"),
              plural(plan.scenes.length, "escena", "escenas"),
              `editado ${ago(screenplay.updatedAt)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {pending === 0 || plan.scenes.length === 0 ? (
            <p className="mt-4 font-sans text-[15px]">
              <span className="text-success">✓ Al día.</span>{" "}
              <span className="text-muted">
                {plan.scenes.length
                  ? `Las ${plural(plan.scenes.length, "escena", "escenas")} del guion están en producción.`
                  : hasScenes
                    ? "El guion aún no tiene escenas escritas; las de aquí se quedan como están hasta que las tenga."
                    : "El guion aún no tiene escenas: en cuanto escribas la primera, podrás pasarla aquí."}
              </span>
            </p>
          ) : (
            <div className={`mt-4 border-l-2 py-1 pl-4 ${firstLink ? "border-accent" : "border-warn"}`}>
              {firstLink ? (
                <p className="font-sans text-[15px]">
                  <strong className="font-semibold">Une las escenas del guion con las que ya tienes aquí.</strong>{" "}
                  <span className="text-muted">
                    {plural(adopting, "escena se reconoce", "escenas se reconocen")} por su número
                    {added.length ? ` y ${plural(added.length, "es nueva", "son nuevas")}` : ""}. Se conservan sus planos, desglose y
                    días de rodaje; a partir de ahí, cada cambio del guion llega aquí con un clic.
                  </span>
                </p>
              ) : (
              <p className="font-sans text-[15px]">
                <strong className="font-semibold">
                  {hasScenes ? "El guion ha cambiado desde la última vez." : "Las escenas del guion aún no están en producción."}
                </strong>{" "}
                <span className="text-muted">
                  {[
                    added.length ? plural(added.length, "escena nueva", "escenas nuevas") : null,
                    changed.length ? plural(changed.length, "cambiada", "cambiadas") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  . Los planos, el desglose y los días de rodaje de cada escena se conservan.
                </span>
              </p>
              )}
            </div>
          )}

          {gone.length > 0 && (
            <p className="mt-3 border-l-2 border-line py-1 pl-4 font-sans text-sm text-muted">
              {gone.length === 1 ? `La escena ${gone[0].number} ya no está` : `Las escenas ${gone.map((g) => g.number).join(", ")} ya no están`} en el
              guion. Aquí no se borra nada sola: si sobra, ábrela y elimínala.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href={href} className={`btn ${pending ? "btn-outline" : "btn-primary"}`}>
              Abrir el guion →
            </Link>
            {pending > 0 && <SyncScenesButton action={sync} label={firstLink ? "Unir las escenas" : undefined} />}
          </div>
        </div>
      </section>
    );
  }

  // Sin guion de Guiones: escribirlo o vincular uno. Subir el PDF sigue
  // estando más abajo (primeros pasos o «Archivo del guion»).
  const write = writeProjectScript.bind(null, projectId);
  const link = linkScriptToProject.bind(null, projectId);

  // El guion ya está subido (sistema de antes): lo primero es pasarlo a
  // Guiones, no empezar uno vacío.
  if (uploadedFile) {
    const isPdf = /\.pdf$/i.test(uploadedFile.name);
    return (
      <section aria-labelledby="guion-fuente" className="mt-9 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        <div
          aria-hidden
          className={`sp-cover block w-28 shrink-0 ${courierPrime.variable}`}
        >
          <span className={`sp-cover-sheet flex flex-col items-center justify-center px-[10%] text-center text-[#1c1b19] ${COVER_SHADOW}`}>
            <span className="font-[family-name:var(--font-courier)] text-[9px] font-bold uppercase">{isPdf ? "PDF" : "DOC"}</span>
            <span className="mt-2 line-clamp-4 font-[family-name:var(--font-courier)] text-[7px] break-all text-[#4a4842]">{uploadedFile.name}</span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-accent">Tu guion · subido el {uploadedFile.uploadedAt.toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" })}</p>
          <h2 id="guion-fuente" className="mt-1.5 font-display text-2xl font-black tracking-tight">
            Pásalo a Guiones y tenlo vivo
          </h2>
          <p className="mt-1 max-w-2xl font-sans text-sm leading-relaxed text-muted">
            Ahora es un archivo. En Guiones se convierte en un guion de verdad: se lee con formato, se sigue escribiendo y, cuando
            cambie, las escenas nuevas llegan aquí con un clic. Las escenas que ya tienes se reconocen por su número y conservan
            planos, desglose y días de rodaje.
          </p>
          {isPdf ? (
            <div className="mt-5 flex flex-wrap items-start gap-x-5 gap-y-3">
              <ActionButtonForm
                action={importUploadedScriptToGuiones.bind(null, projectId)}
                pendingLabel="Leyendo el PDF y pasándolo…"
                className="btn btn-primary"
              >
                Pasar mi guion a Guiones
              </ActionButtonForm>
            </div>
          ) : (
            <p className="mt-4 border-l-2 border-warn py-1 pl-4 font-sans text-sm">
              Está en Word: expórtalo a PDF y súbelo de nuevo (abajo, en «Archivo del guion») para poder pasarlo.
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="guion-fuente" className={hasScenes ? "mt-9 border-l-2 border-line py-1 pl-4" : "mt-10"}>
      <h2 id="guion-fuente" className={hasScenes ? "font-sans text-[15px] font-semibold" : "font-display text-2xl font-black tracking-tight"}>
        {hasScenes ? "¿Sigue cambiando el guion?" : "¿Dónde está tu guion?"}
      </h2>
      <p className="mt-1 max-w-2xl font-sans text-sm leading-relaxed text-muted">
        {hasScenes
          ? "Escríbelo o vincúlalo en Guiones y, cada vez que cambie, pasas las escenas nuevas aquí con un clic, sin perder planos ni días de rodaje."
          : "Escríbelo en Guiones, vincula uno que ya tengas allí o sube el PDF. Sus escenas y personajes llegan aquí para preparar el rodaje."}
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
        <form action={write}>
          <SubmitButton pendingLabel="Creando el guion…" className={hasScenes ? "btn btn-outline btn-sm" : "btn btn-primary"}>
            Escribir el guion en Guiones
          </SubmitButton>
        </form>
        {candidates.length > 0 && (
          <form action={link} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="eyebrow">O vincula uno</span>
              <select name="screenplayId" required defaultValue="" className="field py-1.5 text-sm">
                <option value="" disabled>
                  Elige un guion…
                </option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton pendingLabel="Vinculando…" className="btn btn-outline btn-sm">
              Vincular
            </SubmitButton>
          </form>
        )}
      </div>
    </section>
  );
}
