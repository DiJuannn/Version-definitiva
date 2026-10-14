import Link from "next/link";
import type { Prisma } from "@/lib/generated/prisma";
import type { CharacterProfile } from "@/lib/screenplay-taller";

// En Personajes de Taller: la ficha que viene del guion vinculado (se edita
// en Guiones; aquí se consulta para casting, vestuario o desglose).
export function ScreenplayProfile({ profile, screenplayId }: { profile: Prisma.JsonValue | null; screenplayId: string | null }) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile) || !screenplayId) return null;
  const p = profile as unknown as CharacterProfile;
  const lines = [
    p.want && ["Quiere", p.want],
    p.need && ["Necesita", p.need],
    p.fear && ["Teme", p.fear],
    p.secret && ["Oculta", p.secret],
    p.arc && ["Arco", p.arc],
  ].filter(Boolean) as [string, string][];
  const images = (p.images ?? []).filter((i) => typeof i?.url === "string" && i.url.startsWith("https://")).slice(0, 6);
  if (!lines.length && !images.length) return null;
  return (
    <div className="mt-2 max-w-xl border-l-2 border-accent/60 pl-3">
      {images.length > 0 && (
        <div className="mb-2 flex gap-1.5">
          {images.map((img) => (
            // eslint-disable-next-line @next/next/no-img-element -- imágenes subidas en la ficha del guion
            <img key={img.id} src={img.url} alt={img.caption ?? ""} className="h-14 w-14 object-cover" />
          ))}
        </div>
      )}
      {lines.map(([k, v]) => (
        <p key={k} className="font-sans text-xs text-fg/80">
          <span className="text-muted">{k}:</span> {v}
        </p>
      ))}
      <Link href={`/app/guiones/${screenplayId}?paso=idea`} className="mt-1 inline-block font-mono text-[10px] tracking-widest text-accent uppercase hover:underline">
        Ficha del guion «{p.screenplayTitle}» →
      </Link>
    </div>
  );
}
