"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileVideo, Upload } from "lucide-react";
import { readVideoMeta, uploadFile, type UploadProgress } from "@/lib/client/uploader";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { formatClock, COMMON_FPS } from "@/lib/domain/timecode";
import { fmtBytes } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/domain/labels";
import type { CorrectionCategory } from "@prisma/client";

type OpenCorrection = { id: string; body: string; timeMs: number | null; originNumber: number; category: CorrectionCategory };

/**
 * Publicar un nuevo montaje: elegir archivo → subida directa con progreso →
 * resumen de cambios + correcciones atendidas → crear versión (interna).
 */
export function NewVersionPanel({ pieceId, nextNumber, openCorrections }: { pieceId: string; nextNumber: number; openCorrections: OpenCorrection[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<{ durationMs: number | null; width: number | null; height: number | null } | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [fps, setFps] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [addressed, setAddressed] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function choose(f: File) {
    setError("");
    setFile(f);
    setAssetId(null);
    const m = await readVideoMeta(f);
    setMeta(m);
    abort.current = new AbortController();
    try {
      const r = await uploadFile(f, { kind: "PREVIEW", pieceId, meta: m }, setProgress, abort.current.signal);
      setAssetId(r.assetId);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
      else setFile(null);
    } finally {
      setProgress(null);
    }
  }

  async function publish() {
    if (!assetId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/pieces/${pieceId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId,
          changeSummary: summary,
          durationMs: meta?.durationMs ?? null,
          width: meta?.width ?? null,
          height: meta?.height ?? null,
          fps: fps ? Number(fps) : null,
          addressedCorrectionIds: addressed,
          sourceUrl,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo crear la versión");
      router.push(`/revision/${body.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const pct = progress ? Math.round((progress.sent / Math.max(1, progress.total)) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      <input ref={input} type="file" accept="video/*" className="sr-only" aria-label="Archivo de vídeo" onChange={(e) => e.target.files?.[0] && choose(e.target.files[0])} />
      {!file ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line-strong px-4 py-8 text-center hover:border-ink hover:bg-surface-2"
        >
          <Upload className="size-6 text-ink-2" />
          <span className="text-sm font-medium">Elegir el montaje V{nextNumber}</span>
          <span className="text-[13px] text-ink-3">MP4, MOV o WebM para revisión. El máster puede ir como enlace.</span>
        </button>
      ) : (
        <div className="rounded-md border border-line bg-surface-2 p-3">
          <div className="flex items-center gap-3">
            <FileVideo className="size-5 text-ink-2" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-[12px] text-ink-3 tabular">
                {fmtBytes(file.size)}
                {meta?.width && ` · ${meta.width}×${meta.height}`}
                {meta?.durationMs && ` · ${formatClock(meta.durationMs)}`}
                {meta && " · leído por el navegador"}
              </p>
            </div>
            {progress ? (
              <Button size="sm" variant="ghost" onClick={() => abort.current?.abort()}>Cancelar</Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => input.current?.click()}>Cambiar</Button>
            )}
          </div>
          {progress && (
            <div className="mt-3" role="status" aria-live="polite">
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full bg-ink transition-[width]" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-[12px] text-ink-3 tabular">
                {progress.phase === "verifying" ? "Verificando integridad…" : progress.phase === "retrying" ? `Reintentando (${progress.attempt}/5)…` : `${pct} % · ${fmtBytes(progress.sent)} de ${fmtBytes(progress.total)}`}
              </p>
            </div>
          )}
          {assetId && <p className="mt-2 text-[12px] text-[var(--tone-success)]">Subido y verificado.</p>}
        </div>
      )}

      <Field label="¿Qué ha cambiado?" htmlFor="summary" hint="El coordinador y el cliente verán este resumen junto a la versión.">
        <Textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="Música cambiada, logo final más grande, subtítulos corregidos…" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fotogramas por segundo" htmlFor="fps" hint="Si no lo sabes, déjalo vacío: el paso por fotograma será aproximado.">
          <Select id="fps" value={fps} onChange={(e) => setFps(e.target.value)}>
            <option value="">No lo sé</option>
            {COMMON_FPS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </Select>
        </Field>
        <Field label="Enlace al máster" htmlFor="source" optional hint="Drive, Dropbox, servidor… Solo se guarda el enlace.">
          <Input id="source" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" />
        </Field>
      </div>

      {openCorrections.length > 0 && (
        <fieldset className="rounded-md border border-line">
          <legend className="ml-3 px-1 text-[13px] font-medium">Correcciones que atiende esta versión</legend>
          <p className="px-3 pt-1 text-[12px] text-ink-3">Se marcarán como «resueltas por el equipo». Quien las pidió podrá verificarlas o reabrirlas.</p>
          <ul className="max-h-64 divide-y divide-line overflow-y-auto">
            {openCorrections.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-surface-2">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[var(--ink)]"
                    checked={addressed.includes(c.id)}
                    onChange={(e) => setAddressed((a) => (e.target.checked ? [...a, c.id] : a.filter((x) => x !== c.id)))}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2">{c.body}</span>
                    <span className="text-[12px] text-ink-3">
                      V{c.originNumber} · {c.timeMs != null ? formatClock(c.timeMs) : "general"} · {CATEGORY_LABEL[c.category]}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {error && <p role="alert" className="text-[13px] text-[var(--tone-danger)]">{error}</p>}
      <div className="flex items-center gap-3">
        <button type="button" disabled={!assetId || saving} onClick={publish} className={buttonClass("primary")}>
          {saving ? "Creando versión…" : `Crear V${nextNumber} para revisión interna`}
        </button>
        <p className="text-[12px] text-ink-3">El cliente no la verá hasta que coordinación la publique.</p>
      </div>
    </div>
  );
}
