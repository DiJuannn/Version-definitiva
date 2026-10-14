import Link from "next/link";
import type { Prisma } from "@/lib/generated/prisma";
import { colorFor } from "@/components/canvas/presence";
import { ActorAssignmentField } from "@/components/ActorAssignmentField";
import { DeleteButton } from "@/components/DeleteButton";
import { FormField } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import type { CharacterProfile } from "@/lib/screenplay-taller";

type CastCharacter = {
  id: string;
  name: string;
  notes: string | null;
  actorId: string | null;
  screenplayId: string | null;
  profile: Prisma.JsonValue | null;
  _count: { scenes: number };
};

const INPUT =
  "border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent";

function profileOf(c: CastCharacter): CharacterProfile | null {
  return c.profile && typeof c.profile === "object" && !Array.isArray(c.profile) ? (c.profile as unknown as CharacterProfile) : null;
}

// Personajes como un tablero de reparto: un retrato por personaje (la foto de
// su ficha del guion, o sus iniciales con su color), quién lo interpreta, en
// cuántas escenas sale y lo esencial de su ficha.
export function CastBoard({
  characters,
  actors,
  update,
  updateActor,
  remove,
}: {
  characters: CastCharacter[];
  actors: { id: string; name: string }[];
  update: (id: string) => (fd: FormData) => Promise<void>;
  updateActor: (id: string) => (fd: FormData) => Promise<void>;
  remove: (id: string) => (fd: FormData) => Promise<void>;
}) {
  const conflictsFor = (id: string) =>
    Object.fromEntries(characters.filter((c) => c.id !== id && c.actorId).map((c) => [c.actorId as string, c.name]));
  const cast = characters.filter((c) => c.actorId).length;

  return (
    <div>
      <p className="mt-8 font-mono text-[11px] tracking-widest text-muted uppercase">
        {characters.length} {characters.length === 1 ? "personaje" : "personajes"} · {cast} con actor
        {characters.length - cast > 0 && <span className="text-accent"> · faltan {characters.length - cast} por repartir</span>}
      </p>
      <ul className="mt-4 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {characters.map((c) => {
          const p = profileOf(c);
          const photo = p?.images?.find((i) => typeof i?.url === "string" && i.url.startsWith("https://"))?.url;
          const actor = actors.find((a) => a.id === c.actorId)?.name ?? null;
          // Mismo tono que su color en Taller, pero apagado: retrato, no confeti.
          const hue = Number(colorFor(c.name).match(/^hsl\((\d+)/)?.[1] ?? 260);
          const tint = `hsl(${hue}, 32%, 42%)`;
          const scenes = c._count.scenes || p?.sceneCount || 0;
          return (
            <li key={c.id} className="group">
              <div
                className="relative aspect-[4/5] overflow-hidden"
                style={{ background: `linear-gradient(160deg, ${tint} -40%, #141217 70%)` }}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto de la ficha del guion (Supabase)
                  <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <span aria-hidden className="absolute inset-0 grid place-items-center font-display text-[7rem] leading-none font-black text-white/15">
                    {c.name.slice(0, 1)}
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pt-16 pb-4">
                  <p className="font-display text-2xl leading-none font-black tracking-tight uppercase">{c.name}</p>
                  <p className={`mt-1.5 font-mono text-[11px] tracking-wide ${actor ? "text-fg/80" : "text-accent"}`}>
                    {actor ? `Interpreta ${actor}` : "Sin actor todavía"}
                  </p>
                </div>
                {scenes > 0 && (
                  <span className="absolute top-3 right-3 bg-black/60 px-2 py-1 font-mono text-[10px] tracking-widest uppercase backdrop-blur">
                    {scenes} {scenes === 1 ? "escena" : "escenas"}
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-1 font-sans text-[13px] leading-snug">
                {p?.want && (
                  <p>
                    <span className="text-muted">Quiere</span> {p.want}
                  </p>
                )}
                {p?.fear && (
                  <p>
                    <span className="text-muted">Teme</span> {p.fear}
                  </p>
                )}
                {c.notes && <p className="text-muted">{c.notes}</p>}
                {c.screenplayId && (
                  <Link
                    href={`/app/guiones/${c.screenplayId}?paso=idea`}
                    className="inline-block pt-1 font-mono text-[10px] tracking-widest text-accent uppercase hover:underline"
                  >
                    Ficha en el guion{p?.screenplayTitle ? ` «${p.screenplayTitle}»` : ""} →
                  </Link>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                <form action={updateActor(c.id)}>
                  <ActorAssignmentField actors={actors} defaultActorId={c.actorId ?? ""} conflicts={conflictsFor(c.id)} />
                </form>
                <details className="relative">
                  <summary className="link-action cursor-pointer list-none">Más ▾</summary>
                  <div className="absolute right-0 z-10 mt-2 w-72 border border-line bg-bg-raised p-4 shadow-2xl">
                    <form action={update(c.id)} className="grid gap-3">
                      <FormField label="Nombre">
                        <input name="name" required defaultValue={c.name} className={INPUT} />
                      </FormField>
                      <FormField label="Notas de producción">
                        <input name="notes" defaultValue={c.notes ?? ""} className={INPUT} />
                      </FormField>
                      <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="btn btn-secondary justify-self-start">
                        Guardar
                      </SubmitButton>
                    </form>
                    <form action={remove(c.id)} className="mt-4 border-t border-line pt-3">
                      <DeleteButton confirmMessage="¿Eliminar este personaje?" className="link-action" />
                    </form>
                  </div>
                </details>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
