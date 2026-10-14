import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import {
  createScene,
  deleteAllScenes,
  deleteScene,
} from "@/lib/actions/scenes";
import { DangerConfirmButton } from "@/components/DangerConfirmButton";
import { deleteScriptFile, uploadScript } from "@/lib/actions/script";
import {
  analyzeScript,
  restoreScriptBackup,
} from "@/lib/actions/script-analysis";
import {
  BACKUP_REASON_LABELS,
  listScriptBackups,
} from "@/lib/project-backup-core";
import { runContinuityCheck } from "@/lib/actions/continuity";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { isPro as isProPlan } from "@/lib/plan";
import { DeleteButton } from "@/components/DeleteButton";
import { ScriptUploadForm } from "@/components/ScriptUploadForm";
import { ActionButtonForm } from "@/components/ActionButtonForm";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import { PageHeader } from "@/components/PageHeader";
import { FileOpenLink } from "@/components/FileOpenLink";
import { SubmitButton } from "@/components/SubmitButton";
import {
  SCRIPT_ANALYSIS_FREE_DAILY_LIMIT,
  SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT,
  SCRIPT_ANALYSIS_PRO_DAILY_LIMIT,
} from "@/lib/limits";
import { SparkleIcon } from "@/components/ToolIcons";

// El análisis de guion y la revisión de continuidad llaman a Mistral y
// pueden tardar más de los 10s que Vercel da por defecto a una función —
// sin esto, funcionaba en local (sin límite) pero fallaba en producción.
// Va aquí (la página) y no en el archivo "use server": un archivo de
// Server Actions solo puede exportar funciones async.
export const maxDuration = 60;

// La página del guion es la escaleta del proyecto: las escenas, en orden,
// como una lista de encabezados de escena. A la derecha, lo que alimenta esa
// lista (el archivo del guion y su lectura por IA) y las herramientas que
// trabajan sobre ella (continuidad, copias). Antes eran tres pestañas: ahora
// todo se ve de un vistazo y lo pendiente sube arriba como aviso.

const SECTION_TITLE = "font-display text-base font-bold";
const SECTION_TEXT = "mt-1.5 font-sans text-sm leading-relaxed text-muted";
const POPOVER =
  "sheet absolute left-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] p-4 shadow-[0_18px_40px_-16px_color-mix(in_srgb,var(--fg)_35%,transparent)] sm:left-auto sm:right-0";

const DATE_FMT: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export default async function GuionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const profile = await getCurrentProfile();
  if (!profile) notFound();

  const [
    backups,
    scriptFiles,
    scenes,
    pendingAnalyses,
    pendingContinuityChecks,
  ] = await Promise.all([
    listScriptBackups(projectId),
    prisma.scriptFile.findMany({
      where: { projectId },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        intExt: true,
        dayPart: true,
        description: true,
        location: { select: { name: true } },
        _count: {
          select: { characters: true, shots: true, breakdownElements: true },
        },
      },
    }),
    prisma.scriptAnalysis.findMany({
      where: { projectId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.continuityCheck.findMany({
      where: { projectId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { issues: true } } },
    }),
  ]);

  const uploadAction = uploadScript.bind(null, projectId);
  const createSceneAction = createScene.bind(null, projectId);
  const runContinuityAction = runContinuityCheck.bind(null, projectId);
  const isPro = isProPlan(profile.organization.plan);
  const isProjectPro = await isProjectOwnerPro(project.organizationId);

  const currentFile = scriptFiles[0] ?? null;
  const limitsText = isPro
    ? `Hasta ${SCRIPT_ANALYSIS_PRO_DAILY_LIMIT} análisis al día.`
    : `${SCRIPT_ANALYSIS_FREE_DAILY_LIMIT} análisis al día, ${SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT} en total con el plan gratuito.`;

  // Formulario mínimo para crear una escena: se abre desde un botón y, al
  // crearla, la acción lleva directamente a su ficha para rellenarla.
  const newSceneForm = (
    <form action={createSceneAction} className="flex items-end gap-2">
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="eyebrow text-muted">Número de escena</span>
        <input
          name="number"
          required
          className="field"
          placeholder={String(scenes.length + 1)}
        />
      </label>
      <SubmitButton
        pendingLabel="Creando…"
        savedLabel="✓ Creada"
        className="btn btn-secondary shrink-0"
      >
        Crear
      </SubmitButton>
    </form>
  );

  const backupsSection =
    backups.length > 0 ? (
      <section
        aria-labelledby="guion-copias"
        className="border-t border-line pt-8"
      >
        <details className="group">
          <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 [&::-webkit-details-marker]:hidden">
            <h2
              id="guion-copias"
              className={`${SECTION_TITLE} group-hover:text-accent`}
            >
              Copias de seguridad
            </h2>
            <span className="font-mono text-[11px] text-muted">
              {backups.length}
              <span
                aria-hidden
                className="ml-2 inline-block transition-transform group-open:rotate-45"
              >
                +
              </span>
            </span>
          </summary>
          <p className={SECTION_TEXT}>
            Se guarda una copia sola antes de reemplazar el guion, eliminar
            todas las escenas o restaurar otra copia. Restaurar devuelve
            escenas, planos, personajes y desglose tal como estaban; lo demás
            (actores, presupuesto, días…) no cambia. Se conservan las últimas 8.
          </p>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {backups.map((backup) => (
              <li
                key={backup.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block font-sans text-sm">
                    {BACKUP_REASON_LABELS[backup.reason] ?? "Copia automática"}
                  </span>
                  <span className="block font-mono text-[11px] text-muted">
                    {backup.createdAt.toLocaleString("es-ES", DATE_FMT)} ·{" "}
                    {plural(backup.sceneCount, "escena", "escenas")} ·{" "}
                    {plural(backup.shotCount, "plano", "planos")}
                  </span>
                </span>
                <DangerConfirmButton
                  trigger="Restaurar"
                  title="¿Restaurar esta copia del guion?"
                  description={`El guion actual (escenas, planos, personajes y desglose) se sustituirá por el de esta copia, del ${backup.createdAt.toLocaleString("es-ES", DATE_FMT)}. Antes se guarda otra copia de lo de ahora, así que también se puede deshacer.`}
                  confirmLabel="Sí, restaurar"
                  pendingLabel="Restaurando…"
                  action={restoreScriptBackup.bind(null, projectId, backup.id)}
                />
              </li>
            ))}
          </ul>
        </details>
      </section>
    ) : null;

  const hasPending =
    pendingAnalyses.length > 0 || pendingContinuityChecks.length > 0;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Preproducción"
        title="Guion"
        description={
          scenes.length > 0
            ? `${plural(scenes.length, "escena", "escenas")}${currentFile ? ` · ${currentFile.fileName}` : ""}. Abre una escena para decir quién sale, qué se necesita y en qué localización se rueda.`
            : "Las escenas de tu película, en orden. De aquí salen el desglose, la lista de planos y el plan de rodaje."
        }
        actions={
          scenes.length > 0 ? (
            <details className="group relative">
              <summary className="btn btn-primary list-none [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className="transition-transform group-open:rotate-45"
                >
                  +
                </span>
                Nueva escena
              </summary>
              <div className={POPOVER}>{newSceneForm}</div>
            </details>
          ) : undefined
        }
      />

      {/* ------------------------------------------------ pendiente */}
      {hasPending && (
        <ul className="mt-8 space-y-3" aria-label="Pendiente de revisar">
          {pendingAnalyses.map((analysis) => (
            <li key={analysis.id}>
              <Link
                href={`/app/${projectId}/guion/analisis/${analysis.id}`}
                className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-l-2 border-warn py-1 pl-4"
              >
                <span className="font-sans text-[15px]">
                  <strong className="font-semibold">
                    La IA ya ha leído tu guion.
                  </strong>{" "}
                  <span className="text-muted">
                    Revisa lo que propone antes de importarlo ·{" "}
                    {analysis.createdAt.toLocaleString("es-ES", DATE_FMT)}
                  </span>
                </span>
                <span className="eyebrow text-accent group-hover:underline">
                  Revisar propuesta →
                </span>
              </Link>
            </li>
          ))}
          {pendingContinuityChecks.map((check) => (
            <li key={check.id}>
              <Link
                href={`/app/${projectId}/guion/continuidad/${check.id}`}
                className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-l-2 border-warn py-1 pl-4"
              >
                <span className="font-sans text-[15px]">
                  <strong className="font-semibold">
                    Continuidad:{" "}
                    {plural(
                      check._count.issues,
                      "posible fallo",
                      "posibles fallos",
                    )}
                    .
                  </strong>{" "}
                  <span className="text-muted">
                    Confírmalos o descártalos ·{" "}
                    {check.createdAt.toLocaleString("es-ES", DATE_FMT)}
                  </span>
                </span>
                <span className="eyebrow text-accent group-hover:underline">
                  Revisar →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {scenes.length === 0 ? (
        /* ------------------------------------------------ primeros pasos */
        <section className="mt-10" aria-label="Primeros pasos">
          <div className="sheet px-6 py-8 sm:px-10 sm:py-10">
            {currentFile ? (
              <>
                <p className="eyebrow text-accent">Paso 2 de 3</p>
                <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
                  Ahora, que la IA lo lea
                </h2>
                <p className="mt-3 max-w-xl font-sans text-[15px] leading-relaxed text-muted">
                  Tu guion ya está subido. Al analizarlo, la IA propone las
                  escenas, los personajes, las localizaciones y el atrezzo. Lo
                  revisas en la pantalla siguiente y no se crea nada hasta que
                  lo confirmes.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <ActionButtonForm
                    action={analyzeScript.bind(null, projectId, currentFile.id)}
                    pendingLabel="Analizando… (menos de un minuto)"
                    className="btn btn-primary"
                  >
                    <SparkleIcon className="h-4 w-4" />
                    Analizar el guion
                  </ActionButtonForm>
                  <FileOpenLink
                    href={currentFile.fileUrl}
                    className="font-mono text-xs text-muted hover:text-fg"
                  >
                    {currentFile.fileName}
                  </FileOpenLink>
                </div>
                <p className="mt-4 font-sans text-xs text-muted">
                  {limitsText}
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-line pt-6">
                  <span className="font-sans text-sm text-muted">
                    ¿No es la versión buena?
                  </span>
                  <ScriptUploadForm
                    action={uploadAction}
                    existingFileName={currentFile.fileName}
                  />
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow text-accent">Paso 1 de 3</p>
                <h2 className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
                  Sube tu guion
                </h2>
                <p className="mt-3 max-w-xl font-sans text-[15px] leading-relaxed text-muted">
                  En PDF o Word, tal como lo tienes. La IA lo lee y te propone
                  las escenas, los personajes y las localizaciones, para que no
                  tengas que teclear nada.
                </p>
                <ol className="mt-8 grid max-w-3xl gap-6 sm:grid-cols-3 sm:gap-0">
                  {[
                    ["Subes", "Tu guion, tal cual."],
                    ["La IA lo lee", "Tarda menos de un minuto."],
                    [
                      "Tú decides",
                      "Revisas y confirmas: nada cambia sin tu visto bueno.",
                    ],
                  ].map(([title, text], i) => (
                    <li
                      key={title}
                      className="flex gap-4 sm:border-l sm:border-line sm:px-6 sm:first:border-l-0 sm:first:pl-0"
                    >
                      <span className="font-display text-3xl leading-none font-black text-accent">
                        {i + 1}
                      </span>
                      <span>
                        <span className="block font-sans text-sm font-semibold">
                          {title}
                        </span>
                        <span className="mt-0.5 block font-sans text-sm text-muted">
                          {text}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="mt-8">
                  <ScriptUploadForm
                    action={uploadAction}
                    existingFileName={null}
                    prominent
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-10 max-w-md">
            <h2 className={SECTION_TITLE}>¿Aún no tienes guion?</h2>
            <p className={SECTION_TEXT}>
              Escríbelo en{" "}
              <Link href="/app/guiones" className="text-accent hover:underline">
                Guiones
              </Link>{" "}
              y vincúlalo a este proyecto, o crea las escenas a mano y sube el guion cuando lo tengas.
            </p>
            <div className="mt-4">{newSceneForm}</div>
          </div>
          {backupsSection && (
            <div className="mt-12 max-w-md">{backupsSection}</div>
          )}
        </section>
      ) : (
        <div className="mt-10 grid gap-x-14 gap-y-14 lg:grid-cols-[minmax(0,1fr)_19rem]">
          {/* ------------------------------------------------ escenas */}
          <section aria-label="Escenas">
            <div className="hidden grid-cols-[3.5rem_minmax(0,1fr)_auto] gap-x-5 px-5 pr-28 pb-2 sm:grid">
              <span className="eyebrow text-muted">Esc.</span>
              <span className="eyebrow text-muted">Encabezado</span>
              <span className="eyebrow text-right text-muted">En la escena</span>
            </div>
            <ol className="sheet divide-y divide-line">
              {scenes.map((scene) => {
                const meta = [
                  scene._count.characters > 0 &&
                    plural(scene._count.characters, "personaje", "personajes"),
                  scene._count.shots > 0 &&
                    plural(scene._count.shots, "plano", "planos"),
                  scene._count.breakdownElements > 0 &&
                    plural(
                      scene._count.breakdownElements,
                      "elemento",
                      "elementos",
                    ),
                ].filter(Boolean) as string[];
                return (
                  <li key={scene.id} className="group relative">
                    <Link
                      href={`/app/${projectId}/guion/${scene.id}`}
                      className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-baseline gap-x-4 px-4 py-4 transition-colors hover:bg-accent/[0.04] focus-visible:bg-accent/[0.06] focus-visible:outline-none sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:gap-x-5 sm:px-5 sm:pr-28"
                    >
                      <span className="font-display text-2xl leading-none font-black tabular-nums transition-colors group-hover:text-accent sm:text-3xl">
                        {scene.number}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-[13px] font-medium tracking-wide uppercase">
                          {INT_EXT_LABELS[scene.intExt]}.{" "}
                          {scene.location ? (
                            scene.location.name
                          ) : (
                            <span className="text-muted normal-case italic">
                              sin localización
                            </span>
                          )}{" "}
                          — {DAY_PART_LABELS[scene.dayPart]}
                        </span>
                        {scene.description && (
                          <span className="mt-1 block truncate font-sans text-sm text-muted">
                            {scene.description}
                          </span>
                        )}
                        {meta.length > 0 && (
                          <span className="mt-1 block font-mono text-[11px] text-muted sm:hidden">
                            {meta.join(" · ")}
                          </span>
                        )}
                      </span>
                      <span className="hidden text-right font-mono text-[11px] whitespace-nowrap text-muted sm:block">
                        {meta.length > 0 ? (
                          meta.join(" · ")
                        ) : (
                          <span className="opacity-60">Por completar</span>
                        )}
                      </span>
                    </Link>
                    <form
                      action={deleteScene.bind(null, projectId, scene.id)}
                      className="absolute right-3 bottom-2 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100"
                    >
                      <DeleteButton
                        confirmMessage="¿Eliminar esta escena?"
                        className="link-action hover:text-danger"
                      />
                    </form>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 flex justify-end">
              <DangerConfirmButton
                trigger="Eliminar todas las escenas"
                triggerClassName="link-action hover:text-danger"
                title="¿Eliminar todas las escenas?"
                description={`Se borrarán las ${scenes.length} escenas de este proyecto, junto con su reparto, desglose y equipo asignados a cada una. El guion subido, los personajes, las localizaciones y el desglose en sí no se tocan. Antes se guarda una copia automática que podrás restaurar desde "Copias de seguridad".`}
                action={deleteAllScenes.bind(null, projectId)}
              />
            </div>
          </section>

          {/* ------------------------------------------------ herramientas */}
          <aside className="space-y-10 lg:pt-7">
            <section aria-labelledby="guion-archivo">
              <h2 id="guion-archivo" className={SECTION_TITLE}>
                Archivo del guion
              </h2>
              {currentFile ? (
                <>
                  <ul className="mt-3 divide-y divide-line border-y border-line">
                    {scriptFiles.map((file, i) => (
                      <li
                        key={file.id}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <span className="min-w-0">
                          <FileOpenLink
                            href={file.fileUrl}
                            className="block truncate font-sans text-sm font-medium hover:text-accent"
                          >
                            {file.fileName}
                          </FileOpenLink>
                          <span className="font-mono text-[11px] text-muted">
                            {i === 0 ? "Actual · " : ""}
                            {file.uploadedAt.toLocaleDateString("es-ES")}
                          </span>
                        </span>
                        <form
                          action={deleteScriptFile.bind(
                            null,
                            projectId,
                            file.id,
                          )}
                          className="shrink-0"
                        >
                          <DeleteButton className="link-action hover:text-danger" />
                        </form>
                      </li>
                    ))}
                  </ul>
                  <p className={`${SECTION_TEXT} mt-4`}>
                    Vuelve a analizarlo si has cambiado el guion: la IA propone
                    las escenas, personajes y atrezzo nuevos y tú eliges qué
                    importar. {limitsText}
                  </p>
                  <div className="mt-4 flex flex-wrap items-start gap-3">
                    <ActionButtonForm
                      action={analyzeScript.bind(
                        null,
                        projectId,
                        currentFile.id,
                      )}
                      pendingLabel="Analizando…"
                      className="btn btn-outline btn-sm"
                    >
                      <SparkleIcon className="h-3.5 w-3.5 text-accent" />
                      Analizar
                    </ActionButtonForm>
                    <ScriptUploadForm
                      action={uploadAction}
                      existingFileName={currentFile.fileName}
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className={SECTION_TEXT}>
                    Sube el guion en PDF o Word y la IA te propondrá escenas,
                    personajes y atrezzo a partir de él.
                  </p>
                  <div className="mt-4">
                    <ScriptUploadForm
                      action={uploadAction}
                      existingFileName={null}
                    />
                  </div>
                </>
              )}
            </section>

            <section
              aria-labelledby="guion-continuidad"
              className="border-t border-line pt-8"
            >
              <h2 id="guion-continuidad" className={SECTION_TITLE}>
                Continuidad
              </h2>
              <p className={SECTION_TEXT}>
                La IA repasa reparto, atrezzo y vestuario en el orden de la
                historia y avisa de lo que no cuadra (un objeto roto que
                reaparece intacto, por ejemplo). Solo señala: nunca cambia nada.
              </p>
              <div className="mt-4">
                {isProjectPro ? (
                  <ActionButtonForm
                    action={runContinuityAction}
                    pendingLabel="Revisando…"
                    className="btn btn-outline btn-sm"
                  >
                    Revisar continuidad
                  </ActionButtonForm>
                ) : (
                  <Link
                    href="/app/organizacion"
                    className="btn btn-outline btn-sm"
                  >
                    Revisar continuidad · PRO
                  </Link>
                )}
              </div>
            </section>

            {backupsSection}
          </aside>
        </div>
      )}
    </div>
  );
}
