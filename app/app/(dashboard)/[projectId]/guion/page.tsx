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
import { PageHeader } from "@/components/PageHeader";
import { FileOpenLink } from "@/components/FileOpenLink";
import { SubmitButton } from "@/components/SubmitButton";
import {
  SCRIPT_ANALYSIS_FREE_DAILY_LIMIT,
  SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT,
  SCRIPT_ANALYSIS_PRO_DAILY_LIMIT,
} from "@/lib/limits";
import { SparkleIcon } from "@/components/ToolIcons";
import { CreateDialog } from "@/components/CreateDialog";
import { NextTool, SceneSlug } from "@/components/preproduccion/SceneSlug";
import { STRIP_LEGEND, stripColor } from "@/components/preproduccion/palette";

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
        characters: {
          select: { character: { select: { id: true, name: true } } },
          orderBy: { character: { name: "asc" } },
        },
        shots: { select: { durationSec: true } },
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

  // ---- Resumen de la tira: lo que un director de producción mira primero.
  const intCount = scenes.filter((s) => s.intExt === "INT").length;
  const extCount = scenes.filter((s) => s.intExt === "EXT").length;
  const mixedCount = scenes.length - intCount - extCount;
  const nightCount = scenes.filter((s) => s.dayPart === "NIGHT").length;
  const castIds = new Set(
    scenes.flatMap((s) => s.characters.map((c) => c.character.id)),
  );
  const noLocation = scenes.filter((s) => !s.location);
  const noCast = scenes.filter((s) => s.characters.length === 0);
  const sceneList = (list: typeof scenes) => {
    const nums = list.map((s) => s.number);
    if (nums.length === 1) return `la ${nums[0]}`;
    if (nums.length <= 5)
      return `la ${nums.slice(0, -1).join(", ")} y la ${nums[nums.length - 1]}`;
    return `${nums.slice(0, 4).join(", ")}… (${nums.length})`;
  };

  // Peso de cada escena para la barra: no guardamos páginas ni octavos, así
  // que si los planos tienen duración se usa la suma de segundos; si no, lo
  // que hay que preparar (planos + elementos de desglose + personajes).
  const timed = scenes.some((s) => s.shots.some((sh) => sh.durationSec));
  const weightOf = (s: (typeof scenes)[number]) =>
    timed
      ? s.shots.reduce((n, sh) => n + (sh.durationSec ?? 0), 0)
      : s._count.shots * 2 + s._count.breakdownElements + s._count.characters;
  const maxWeight = Math.max(1, ...scenes.map(weightOf));
  const fmtSeconds = (sec: number) =>
    sec >= 60 ? `${Math.floor(sec / 60)}′${String(sec % 60).padStart(2, "0")}″` : `${sec}″`;

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
    pendingAnalyses.length > 0 ||
    pendingContinuityChecks.length > 0 ||
    noLocation.length > 0 ||
    noCast.length > 0;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Preproducción"
        title="Guion"
        description="Las escenas de tu película en orden, como tiras de un guion. Abre una para decir dónde se rueda, quién sale y qué se necesita."
        actions={
          scenes.length > 0 ? (
            <CreateDialog
              label="Nueva escena"
              title="Nueva escena"
              description="Ponle número; al crearla se abre su ficha para rellenar el resto."
            >
              {newSceneForm}
            </CreateDialog>
          ) : undefined
        }
      />

      {/* ------------------------------------------------ cómo voy */}
      {scenes.length > 0 && (
        <dl className="mt-9 flex flex-wrap items-baseline gap-x-8 gap-y-3">
          {[
            [scenes.length, scenes.length === 1 ? "escena" : "escenas"],
            [intCount, "int."],
            [extCount, "ext."],
            ...(mixedCount > 0 ? [[mixedCount, "int./ext."] as const] : []),
            [nightCount, nightCount === 1 ? "noche" : "noches"],
            [castIds.size, castIds.size === 1 ? "personaje" : "personajes"],
          ].map(([n, label], i) => (
            <div
              key={String(label)}
              className={`flex items-baseline gap-2 ${i === 1 ? "sm:border-l sm:border-line sm:pl-8" : ""}`}
            >
              <dd className="font-display text-2xl leading-none font-black tabular-nums">
                {n}
              </dd>
              <dt className="font-sans text-sm text-muted">{label}</dt>
            </div>
          ))}
        </dl>
      )}

      {/* ------------------------------------------------ pendiente */}
      {hasPending && (
        <ul className="mt-7 space-y-3" aria-label="Pendiente de revisar">
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
          {noLocation.length > 0 && (
            <li>
              <Link
                href={`/app/${projectId}/guion/${noLocation[0].id}`}
                className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-l-2 border-warn py-1 pl-4"
              >
                <span className="font-sans text-[15px]">
                  <strong className="font-semibold">
                    {noLocation.length === scenes.length
                      ? "Ninguna escena tiene localización."
                      : `${plural(noLocation.length, "escena", "escenas")} sin localización: ${sceneList(noLocation)}.`}
                  </strong>{" "}
                  <span className="text-muted">
                    Sin ella no se pueden agrupar en el plan de rodaje.
                  </span>
                </span>
                <span className="eyebrow text-accent group-hover:underline">
                  Abrir la {noLocation[0].number} →
                </span>
              </Link>
            </li>
          )}
          {noCast.length > 0 && (
            <li>
              <Link
                href={`/app/${projectId}/guion/${noCast[0].id}`}
                className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-l-2 border-warn py-1 pl-4"
              >
                <span className="font-sans text-[15px]">
                  <strong className="font-semibold">
                    {`${plural(noCast.length, "escena", "escenas")} sin personajes: ${sceneList(noCast)}.`}
                  </strong>{" "}
                  <span className="text-muted">
                    Márcalos para saber a quién citar cada día.
                  </span>
                </span>
                <span className="eyebrow text-accent group-hover:underline">
                  Abrir la {noCast[0].number} →
                </span>
              </Link>
            </li>
          )}
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
          <section aria-labelledby="guion-tira">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pb-3">
              <h2 id="guion-tira" className={SECTION_TITLE}>
                La tira del guion
              </h2>
              {/* Leyenda de la franja de color: como en un stripboard. */}
              <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Color de la franja">
                {STRIP_LEGEND.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center gap-1.5 font-sans text-xs text-muted"
                  >
                    <span
                      aria-hidden
                      className="h-2.5 w-1 rounded-full"
                      style={{ background: item.color }}
                    />
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
            <ol className="sheet divide-y divide-line overflow-hidden">
              {scenes.map((scene) => {
                const weight = weightOf(scene);
                const pct = Math.max(4, Math.round((weight / maxWeight) * 100));
                const weightLabel = timed
                  ? weight > 0
                    ? fmtSeconds(weight)
                    : "sin duración"
                  : [
                      plural(scene._count.shots, "plano", "planos"),
                      plural(
                        scene._count.breakdownElements,
                        "elem.",
                        "elem.",
                      ),
                    ].join(" · ");
                return (
                  <li key={scene.id} className="group relative">
                    {/* Franja de color: interior/exterior y día/noche. */}
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-1.5"
                      style={{ background: stripColor(scene.intExt, scene.dayPart) }}
                    />
                    <Link
                      href={`/app/${projectId}/guion/${scene.id}`}
                      className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 py-5 pr-4 pl-6 transition-colors hover:bg-accent/[0.05] focus-visible:bg-accent/[0.07] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:grid-cols-[3.25rem_minmax(0,1fr)_12rem] sm:gap-x-5 sm:pr-8 sm:pl-7"
                    >
                      <span className="font-display text-3xl leading-none font-black tabular-nums transition-colors group-hover:text-accent sm:text-4xl">
                        {scene.number}
                      </span>
                      <span className="min-w-0">
                        <SceneSlug
                          intExt={scene.intExt}
                          dayPart={scene.dayPart}
                          location={scene.location?.name}
                          className="block text-[15px] leading-snug sm:text-base"
                        />
                        {scene.description && (
                          <span className="mt-1 block font-sans text-sm leading-relaxed text-muted sm:truncate">
                            {scene.description}
                          </span>
                        )}
                        <span className="mt-2.5 flex flex-wrap gap-1.5">
                          {scene.characters.length > 0 ? (
                            scene.characters.map(({ character }) => (
                              <span
                                key={character.id}
                                className="rounded-full bg-fg/[0.08] px-2.5 py-0.5 font-mono text-[10.5px] tracking-wide text-fg/85 uppercase"
                              >
                                {character.name}
                              </span>
                            ))
                          ) : (
                            <span className="font-sans text-xs text-warn">
                              Sin personajes
                            </span>
                          )}
                        </span>
                      </span>
                      {/* Barra de peso: cuánto hay que preparar (o cuánto dura). */}
                      <span className="col-span-2 mt-3 flex items-center gap-3 sm:col-span-1 sm:mt-0 sm:flex-col sm:items-stretch sm:gap-1.5 sm:self-center">
                        <span
                          aria-hidden
                          className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/[0.08] sm:flex-none"
                        >
                          <span
                            className="block h-full rounded-full bg-fg/60"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-muted tabular-nums sm:text-right">
                          {weightLabel}
                        </span>
                      </span>
                    </Link>
                    <form
                      action={deleteScene.bind(null, projectId, scene.id)}
                      className="absolute top-4 right-3 sm:top-3 sm:right-5 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100"
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
            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
            <p className="font-sans text-xs text-muted">
              {timed
                ? "La barra es la duración prevista de sus planos."
                : "La barra es cuánto hay que preparar: planos, elementos del desglose y personajes."}
            </p>
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
          <aside className="space-y-10 lg:pt-10">
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
      {scenes.length > 0 && (
        <NextTool
          href={`/app/${projectId}/desglose`}
          label="Desglose"
          hint="Todo lo que hay que conseguir para rodar estas escenas."
        />
      )}
    </div>
  );
}
