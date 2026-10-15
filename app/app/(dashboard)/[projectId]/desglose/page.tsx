import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { DeleteButton } from "@/components/DeleteButton";
import {
  createBreakdownElement,
  deleteBreakdownElement,
  updateBreakdownElementCategory,
} from "@/lib/actions/breakdown";
import { BREAKDOWN_CATEGORY_LABELS } from "@/lib/labels";
import { BreakdownCategory } from "@/lib/generated/prisma";
import { PageHeader } from "@/components/PageHeader";
import { SceneToolSwitch } from "@/components/preproduccion/SceneToolSwitch";
import { SubmitButton } from "@/components/SubmitButton";
import { BreakdownCategorySelect } from "@/components/BreakdownCategorySelect";
import { CreateDialog, DialogCancel } from "@/components/CreateDialog";
import { NextTool, SceneSlug } from "@/components/preproduccion/SceneSlug";
import { BREAKDOWN_COLUMNS, CATEGORY_COLOR, stripColor, type BreakdownColumn } from "@/components/preproduccion/palette";
import { BreakdownScene } from "@/components/preproduccion/BreakdownScene";
import { courierPrime } from "@/lib/screenplay/font";
import { getScenesText } from "@/lib/scene-text";

// El desglose como se hace en producción: una matriz ESCENAS × CATEGORÍAS,
// cada categoría con su color de siempre, y en cada celda cuántas cosas de
// esa categoría pide la escena. La columna final suma, así se ve de un
// vistazo qué escena es «cara». Debajo, la lista de elementos por categoría
// (donde se añaden, se recolocan y se borran). Reparto y figuración no son
// elementos de desglose: salen de la ficha de cada escena (personajes
// marcados y notas de extras), pero se pintan aquí porque son lo primero que
// mira cualquiera al leer un desglose.

// Texto oscuro sobre las celdas de color: los colores son claros (mesa oscura).
const ON_COLOR = "#141317";

export default async function DesglosePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ vista?: string; escena?: string }>;
}) {
  const { projectId } = await params;
  const sp = await searchParams;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [elements, scenes] = await Promise.all([
    prisma.breakdownElement.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        notes: true,
        category: true,
        scenes: { select: { scene: { select: { id: true, number: true, order: true } } } },
      },
    }),
    // Solo lectura: las escenas con lo que piden, para la matriz.
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        intExt: true,
        dayPart: true,
        extrasNotes: true,
        scriptSid: true,
        description: true,
        action: true,
        dialogueNotes: true,
        location: { select: { name: true } },
        characters: { select: { character: { select: { name: true } } } },
        breakdownElements: {
          select: { breakdownElement: { select: { id: true, name: true, category: true } } },
        },
      },
    }),
  ]);

  const createElementAction = createBreakdownElement.bind(null, projectId);
  const groups = Object.values(BreakdownCategory).map((category) => ({
    category,
    items: elements.filter((el) => el.category === category),
  }));
  const filled = groups.filter((g) => g.items.length > 0);
  const unassigned = elements.filter((el) => el.scenes.length === 0);

  // Matriz: por escena, qué nombres hay en cada columna.
  const rows = scenes.map((scene) => {
    const cells = new Map<BreakdownColumn, string[]>();
    cells.set(
      "CAST",
      scene.characters.map((c) => c.character.name),
    );
    cells.set("EXTRAS", scene.extrasNotes?.trim() ? [scene.extrasNotes.trim()] : []);
    for (const { breakdownElement } of scene.breakdownElements) {
      const list = cells.get(breakdownElement.category) ?? [];
      list.push(breakdownElement.name);
      cells.set(breakdownElement.category, list);
    }
    const total = [...cells.values()].reduce((n, l) => n + l.length, 0);
    return { scene, cells, total };
  });
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  const heaviest = rows.filter((r) => r.total === maxTotal && r.total > 0);
  const usedColumns = new Set(
    rows.flatMap((r) => [...r.cells.entries()].filter(([, l]) => l.length > 0).map(([k]) => k)),
  );

  const addForm = (
    <form action={createElementAction} className="grid gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="eyebrow text-muted">Categoría</span>
        <select name="category" defaultValue="PROP" className="field">
          {Object.values(BreakdownCategory).map((c) => (
            <option key={c} value={c} className="bg-bg">
              {BREAKDOWN_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="eyebrow text-muted">Nombre</span>
        <input name="name" required placeholder="Claqueta, chaqueta vaquera, grúa…" className="field" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="eyebrow text-muted">Notas (opcional)</span>
        <input name="notes" placeholder="Dos unidades, de época…" className="field" />
      </label>
      <div className="flex items-center gap-4">
        <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido" className="btn btn-primary">
          Añadir al desglose
        </SubmitButton>
        <DialogCancel />
      </div>
    </form>
  );

  const sceneLink = (id: string) => `/app/${projectId}/guion/${id}`;

  // Dos vistas: escena a escena (leer y marcar, la de trabajo) y la lista de
  // lo que hay que conseguir (matriz y categorías, la de repaso).
  const view = sp.vista === "lista" || scenes.length === 0 ? "lista" : "escena";
  const tabs = scenes.length > 0 && (
    <nav aria-label="Vistas del desglose" className="mt-8 flex gap-1 border-b border-line">
      {[
        ["escena", "Escena a escena", `/app/${projectId}/desglose`],
        ["lista", "Lo que hay que conseguir", `/app/${projectId}/desglose?vista=lista`],
      ].map(([key, label, href]) => (
        <Link
          key={key}
          href={href}
          aria-current={view === key ? "page" : undefined}
          className={`-mb-px border-b-2 px-3.5 py-2.5 font-sans text-[14px] transition-colors ${
            view === key ? "border-accent font-semibold text-fg" : "border-transparent text-muted hover:text-fg"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );

  if (view === "escena") {
    const index = Math.max(0, scenes.findIndex((s) => s.id === sp.escena));
    const scene = scenes[index];
    const texts = await getScenesText(projectId, [scene]);
    const linked = scene.breakdownElements.map((b) => b.breakdownElement);
    const linkedIds = new Set(linked.map((e) => e.id));
    const others = elements.filter((e) => !linkedIds.has(e.id)).map((e) => ({ id: e.id, name: e.name, category: e.category }));
    const done = scenes.filter((s) => s.breakdownElements.length > 0).length;
    const href = (id: string) => `/app/${projectId}/desglose?escena=${id}`;
    const prev = scenes[index - 1];
    const next = scenes[index + 1];
    return (
      <div className={`pb-16 ${courierPrime.variable}`}>
        <PageHeader
          eyebrow="Preparar"
          title="Desglose"
          description="Lee cada escena y marca lo que hace falta para rodarla: selecciona la palabra y elige si es atrezzo, vestuario, un vehículo… Al final tienes la lista de todo lo que hay que conseguir."
        />
        {tabs}
        <p className="mt-6 font-sans text-[15px]">
          <b className="font-semibold">{done} de {scenes.length}</b>{" "}
          <span className="text-muted">escenas con algo marcado · {elements.length} cosas que conseguir en total.</span>
        </p>

        <div className="mt-6 grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
          {/* Escenas: dónde estás y cuáles faltan. */}
          <nav aria-label="Escenas" className="lg:sticky lg:top-28 lg:self-start">
            <ol className="flex gap-1 overflow-x-auto pb-2 lg:block lg:space-y-0.5 lg:overflow-visible lg:pb-0">
              {scenes.map((s) => {
                const on = s.id === scene.id;
                const count = s.breakdownElements.length;
                return (
                  <li key={s.id} className="shrink-0">
                    <Link
                      href={href(s.id)}
                      aria-current={on ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-lg border-l-4 py-2 pr-2.5 pl-2.5 font-sans text-[13px] transition-colors ${
                        on ? "bg-bg-raised text-fg" : "text-muted hover:bg-bg-raised/60 hover:text-fg"
                      }`}
                      style={{ borderLeftColor: stripColor(s.intExt, s.dayPart) }}
                    >
                      <span className="w-5 font-display font-black text-fg">{s.number}</span>
                      <span className="hidden min-w-0 flex-1 truncate lg:block">{s.location?.name ?? "Sin localización"}</span>
                      <span className={`font-mono text-[11px] ${count ? "text-success" : "text-muted/60"}`}>{count ? `${count} ✓` : "—"}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>

          <section aria-labelledby="escena-titulo" className="min-w-0">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="escena-titulo" className="flex items-baseline gap-3 text-lg">
                <span className="font-display text-3xl font-black">{scene.number}</span>
                <SceneSlug intExt={scene.intExt} dayPart={scene.dayPart} location={scene.location?.name} />
              </h2>
              <span className="flex items-center gap-4 font-sans text-sm">
                {prev && (
                  <Link href={href(prev.id)} className="text-muted hover:text-fg">
                    ← Escena {prev.number}
                  </Link>
                )}
                {next && (
                  <Link href={href(next.id)} className="btn btn-outline btn-sm">
                    Escena {next.number} →
                  </Link>
                )}
              </span>
            </div>
            <div className="mb-5">
              <SceneToolSwitch projectId={projectId} sceneId={scene.id} active="desglose" />
            </div>
            <BreakdownScene
              key={scene.id}
              projectId={projectId}
              sceneId={scene.id}
              text={texts.get(scene.id) ?? { source: "ficha", blocks: [] }}
              cast={scene.characters.map((c) => c.character.name)}
              linked={linked}
              others={others}
            />
          </section>
        </div>
        <NextTool
          href={`/app/${projectId}/shot-list?escena=${scene.id}`}
          label={`Planos de la escena ${scene.number}`}
          hint="Con lo que hace falta ya marcado, decide cómo se rueda."
        />
      </div>
    );
  }

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Preparar"
        title="Desglose"
        description="Todo lo que hay que conseguir para el rodaje, por categorías y con su color, y en qué escenas sale cada cosa."
        actions={
          elements.length > 0 ? (
            <CreateDialog
              label="Añadir elemento"
              title="Añadir al desglose"
              description="Después márcalo en las escenas donde sale, desde la ficha de cada escena."
            >
              {addForm}
            </CreateDialog>
          ) : undefined
        }
      />
      {tabs}

      {elements.length === 0 && scenes.length === 0 ? (
        <section className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="max-w-md">
            <h2 className="font-display text-xl font-bold">Empieza la lista</h2>
            <p className="mt-2 font-sans text-[15px] leading-relaxed text-muted">
              Añade el primer elemento aquí. Si subes el guion en{" "}
              <Link href={`/app/${projectId}/guion`} className="text-accent hover:underline">
                Guion
              </Link>
              , la IA propone el atrezzo y el vestuario por ti.
            </p>
          </div>
          <div className="paper p-6">{addForm}</div>
        </section>
      ) : (
        <>
          {/* ------------------------------------------------ cómo voy */}
          <dl className="mt-9 flex flex-wrap items-baseline gap-x-8 gap-y-3">
            <div className="flex items-baseline gap-2">
              <dd className="font-display text-2xl leading-none font-black tabular-nums">{elements.length}</dd>
              <dt className="font-sans text-sm text-muted">{elements.length === 1 ? "elemento" : "elementos"}</dt>
            </div>
            <div className="flex items-baseline gap-2">
              <dd className="font-display text-2xl leading-none font-black tabular-nums">
                {filled.length}
                <span className="text-muted">/{groups.length}</span>
              </dd>
              <dt className="font-sans text-sm text-muted">categorías con algo</dt>
            </div>
            {heaviest.length > 0 && (
              <div className="flex items-baseline gap-2 sm:border-l sm:border-line sm:pl-8">
                <dt className="font-sans text-sm text-muted">La más cargada:</dt>
                <dd className="font-sans text-sm">
                  {heaviest.map((r, i) => (
                    <span key={r.scene.id}>
                      {i > 0 && ", "}
                      <Link href={sceneLink(r.scene.id)} className="font-semibold hover:text-accent">
                        escena {r.scene.number}
                      </Link>
                    </span>
                  ))}{" "}
                  <span className="text-muted">({cosas(maxTotal)})</span>
                </dd>
              </div>
            )}
          </dl>
          {unassigned.length > 0 && (
            <p className="mt-6 border-l-2 border-warn py-0.5 pl-4 font-sans text-[15px]">
              <strong className="font-semibold">
                {unassigned.length === 1 ? "1 elemento no está" : `${unassigned.length} elementos no están`} en ninguna
                escena:
              </strong>{" "}
              <span className="text-muted">
                {unassigned.map((e) => e.name).join(", ")}. Márcalos en la ficha de la escena donde salen, o bórralos si
                sobran.
              </span>
            </p>
          )}

          {/* ------------------------------------------------ matriz */}
          {scenes.length > 0 && (
            <section aria-labelledby="desglose-matriz" className="mt-10">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <h2 id="desglose-matriz" className="font-display text-lg font-bold">
                  Escena por escena
                </h2>
                <p className="font-sans text-xs text-muted">Pasa el ratón por una celda para ver qué es.</p>
              </div>
              <div className="sheet mt-3 overflow-x-auto">
                <table className="w-full min-w-[46rem] border-collapse text-left">
                  <caption className="sr-only">
                    Matriz de desglose: escenas en filas, categorías en columnas, con el número de elementos de cada
                    categoría en cada escena.
                  </caption>
                  <thead>
                    <tr className="border-b border-line">
                      <th
                        scope="col"
                        className="sticky left-0 z-10 bg-bg-raised py-3 pr-3 pl-5 align-bottom font-mono text-[10px] font-normal tracking-widest text-muted uppercase"
                      >
                        Escena
                      </th>
                      {BREAKDOWN_COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          scope="col"
                          title={col.label}
                          className={`w-[3.75rem] px-1 pt-3 pb-2.5 text-center align-bottom font-sans text-[11px] leading-tight font-medium ${usedColumns.has(col.key) ? "text-fg" : "text-muted/60"}`}
                        >
                          <span
                            aria-hidden
                            className="mx-auto mb-1.5 block h-1 w-6 rounded-full"
                            style={{ background: col.color, opacity: usedColumns.has(col.key) ? 1 : 0.35 }}
                          />
                          {col.short}
                        </th>
                      ))}
                      <th
                        scope="col"
                        className="w-[8.5rem] py-3 pr-5 pl-3 text-right align-bottom font-mono text-[10px] font-normal tracking-widest text-muted uppercase"
                      >
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map(({ scene, cells, total }) => (
                      <tr key={scene.id} className="group transition-colors hover:bg-accent/[0.04]">
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-bg-raised py-2.5 pr-3 pl-5 text-left font-normal"
                        >
                          <Link
                            href={sceneLink(scene.id)}
                            className="flex items-baseline gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                          >
                            <span className="w-7 shrink-0 font-display text-xl leading-none font-black tabular-nums group-hover:text-accent">
                              {scene.number}
                            </span>
                            <SceneSlug
                              intExt={scene.intExt}
                              dayPart={scene.dayPart}
                              location={scene.location?.name}
                              className="hidden max-w-[17rem] truncate text-[13px] md:block"
                            />
                          </Link>
                        </th>
                        {BREAKDOWN_COLUMNS.map((col) => {
                          const list = cells.get(col.key) ?? [];
                          return (
                            <td key={col.key} className="px-1 py-2.5 text-center">
                              {list.length > 0 ? (
                                <span
                                  title={`${col.label}: ${list.join(", ")}`}
                                  className="inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 font-mono text-[12px] font-bold tabular-nums"
                                  style={{ background: col.color, color: ON_COLOR }}
                                >
                                  <span className="sr-only">{col.label}: </span>
                                  {list.length}
                                </span>
                              ) : (
                                <span aria-label={`${col.label}: nada`} className="text-muted/40">
                                  ·
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2.5 pr-5 pl-3">
                          <span className="flex items-center justify-end gap-2.5">
                            <span aria-hidden className="h-1.5 w-16 overflow-hidden rounded-full bg-fg/[0.08]">
                              <span
                                className={`block h-full rounded-full ${total === maxTotal && total > 0 ? "bg-fg" : "bg-fg/45"}`}
                                style={{ width: `${Math.round((total / maxTotal) * 100)}%` }}
                              />
                            </span>
                            <span
                              className={`w-5 text-right font-display text-base tabular-nums ${total === maxTotal && total > 0 ? "font-black" : "font-bold text-muted"}`}
                            >
                              {total}
                            </span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 font-sans text-xs text-muted">
                Reparto y figuración vienen de la ficha de cada escena (personajes marcados y notas de extras).
              </p>
            </section>
          )}

          {/* ------------------------------------------------ lista por categoría */}
          {filled.length > 0 && (
            <section aria-labelledby="desglose-lista" className="mt-14">
              <h2 id="desglose-lista" className="font-display text-lg font-bold">
                Lo que hay que conseguir
              </h2>
              <nav aria-label="Categorías" className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                {filled.map((g) => (
                  <a
                    key={g.category}
                    href={`#cat-${g.category.toLowerCase()}`}
                    className="flex items-center gap-2 font-sans text-sm text-muted hover:text-fg"
                  >
                    <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_COLOR[g.category] }} />
                    {BREAKDOWN_CATEGORY_LABELS[g.category]}
                    <span className="font-mono text-[11px] tabular-nums">{g.items.length}</span>
                  </a>
                ))}
              </nav>

              <div className="sheet mt-5 overflow-hidden">
                {filled.map((g) => (
                  <section
                    key={g.category}
                    id={`cat-${g.category.toLowerCase()}`}
                    aria-labelledby={`cat-${g.category.toLowerCase()}-t`}
                    className="relative scroll-mt-40 border-t border-line first:border-t-0"
                  >
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-1"
                      style={{ background: CATEGORY_COLOR[g.category] }}
                    />
                    <h3
                      id={`cat-${g.category.toLowerCase()}-t`}
                      className="flex items-baseline gap-3 px-5 pt-5 pb-1 sm:px-7"
                    >
                      <span className="font-display text-base font-bold">{BREAKDOWN_CATEGORY_LABELS[g.category]}</span>
                      <span className="font-mono text-[11px] text-muted">{g.items.length}</span>
                    </h3>
                    <ul className="divide-y divide-line">
                      {g.items.map((item) => {
                        const inScenes = item.scenes
                          .map((s) => s.scene)
                          .sort((a, b) => a.order - b.order);
                        return (
                          <li
                            key={item.id}
                            className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_12rem_10rem_auto] sm:px-7"
                          >
                            <span className="col-start-1 row-start-1 min-w-0">
                              <span className="block font-sans text-[15px] font-medium">{item.name}</span>
                              {item.notes && <span className="block font-sans text-[13px] text-muted">{item.notes}</span>}
                            </span>
                            <span className="col-span-2 col-start-1 row-start-2 flex flex-wrap items-center gap-1 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                              {inScenes.length === 0 ? (
                                <span className="font-sans text-xs text-warn">En ninguna escena</span>
                              ) : (
                                <>
                                  <span className="mr-1 font-sans text-xs text-muted">Esc.</span>
                                  {inScenes.map((s) => (
                                    <Link
                                      key={s.id}
                                      href={sceneLink(s.id)}
                                      className="rounded bg-fg/[0.08] px-1.5 py-0.5 font-mono text-[11px] tabular-nums hover:bg-accent/20 hover:text-fg"
                                    >
                                      {s.number}
                                    </Link>
                                  ))}
                                </>
                              )}
                            </span>
                            <span className="col-start-1 row-start-3 -ml-2 min-w-0 max-w-[12rem] sm:col-start-3 sm:row-start-1 sm:ml-0 sm:max-w-none">
                              <BreakdownCategorySelect
                                category={item.category}
                                action={updateBreakdownElementCategory.bind(null, projectId, item.id)}
                              />
                            </span>
                            <form
                              action={deleteBreakdownElement.bind(null, projectId, item.id)}
                              className="col-start-2 row-start-1 justify-self-end sm:col-start-4"
                            >
                              <DeleteButton
                                confirmMessage="¿Eliminar este elemento del desglose?"
                                className="link-action hover:text-danger"
                              />
                            </form>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </section>
          )}

          {elements.length === 0 && (
            <div className="mt-12 max-w-md">
              <h2 className="font-display text-lg font-bold">Aún no hay nada que conseguir</h2>
              <p className="mt-2 font-sans text-sm text-muted">
                Añade el atrezzo, vestuario o material que piden las escenas y márcalo en cada una.
              </p>
              <div className="paper mt-5 p-6">{addForm}</div>
            </div>
          )}

          <NextTool
            href={`/app/${projectId}/personajes`}
            label="Personajes"
            hint="Quién hace de quién, para poder citar al reparto."
          />
        </>
      )}
    </div>
  );
}

function cosas(n: number) {
  return `${n} ${n === 1 ? "cosa" : "cosas"}`;
}
