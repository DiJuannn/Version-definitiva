import Link from "next/link";
import { redirect } from "next/navigation";
import { Play } from "lucide-react";
import { resolveGuest, guestContents } from "@/lib/services/guest-view";
import { Tape } from "@/components/ui/chip";
import { DownloadButton } from "@/components/work/download-button";
import { VERSION_STATUS } from "@/lib/domain/labels";
import { fmtDate } from "@/lib/format";
import { IdentifyForm } from "./identify-form";

export default async function GuestHome(props: PageProps<"/r/[token]">) {
  const { token } = await props.params;
  const r = await resolveGuest(token);
  if (r.state === "invalid" || r.state === "expired") {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-bold">Este enlace no está disponible</h1>
        <p className="mt-2 text-sm text-ink-2">Puede haber caducado o haber sido revocado. Pide a la agencia un enlace nuevo.</p>
      </Shell>
    );
  }
  if (r.state === "identify") {
    return (
      <Shell>
        <p className="text-[13px] text-ink-3">Te han invitado a revisar</p>
        <h1 className="font-display text-2xl font-bold">{r.link.name}</h1>
        <p className="mt-2 mb-6 text-sm text-ink-2">Dinos quién eres para que el equipo sepa de quién son los comentarios.</p>
        <IdentifyForm token={token} needsPassword={!!r.link.passwordHash} needsEmail={r.link.requireIdentity} domain={r.link.allowedDomain} />
      </Shell>
    );
  }
  const g = r.guest;
  if (g.link.scope === "VERSION" && g.link.versionId) redirect(`/r/${token}/v/${g.link.versionId}`);
  const { project, pieces } = await guestContents(g);
  return (
    <Shell wide>
      <p className="text-[13px] text-ink-3">{project?.client.name}</p>
      <h1 className="font-display text-2xl font-bold">{project?.name}</h1>
      <p className="mt-1 text-sm text-ink-2">Hola, {g.name}. Elige qué quieres revisar.</p>
      <ul className="mt-6 flex flex-col gap-3">
        {pieces.map((p) => (
          <li key={p.id} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1 font-medium">{p.title}</p>
              {p.versions[0] ? (
                <Link href={`/r/${token}/v/${p.versions[0].id}`} className="inline-flex h-9 items-center gap-2 rounded-md bg-ink px-3 text-sm font-medium text-white">
                  <Play className="size-4" /> Revisar V{p.versions[0].number}
                </Link>
              ) : (
                <span className="text-[13px] text-ink-3">Aún no hay versión publicada</span>
              )}
            </div>
            {p.versions.length > 1 && (
              <p className="mt-2 flex flex-wrap gap-2 text-[13px] text-ink-3">
                Anteriores:
                {p.versions.slice(1).map((v) => (
                  <Link key={v.id} href={`/r/${token}/v/${v.id}`} className="underline">
                    V{v.number} ({VERSION_STATUS[v.status].label.toLowerCase()}, {fmtDate(v.publishedAt)})
                  </Link>
                ))}
              </p>
            )}
            {g.link.canDownload &&
              p.deliveries.map((d) => (
                <div key={d.id} className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                  <Tape variant="marker">V{d.version.number}</Tape>
                  <span className="flex-1 truncate text-sm">{d.asset.filename}</span>
                  <DownloadButton assetId={d.assetId} linkId={g.link.id} />
                </div>
              ))}
          </li>
        ))}
      </ul>
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="flex min-h-dvh flex-col bg-bg">
      <header className="flex h-14 items-center px-5">
        <span className="font-display text-lg font-extrabold">
          Corte<span className="text-[#d9a900]">/</span>
        </span>
      </header>
      <div className={`mx-auto w-full px-4 py-10 ${wide ? "max-w-2xl" : "max-w-md"}`}>{children}</div>
    </main>
  );
}
