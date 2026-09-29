"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import { uploadFile, type UploadKind, type UploadProgress } from "@/lib/client/uploader";
import { buttonClass } from "@/components/ui/button";
import { fmtBytes } from "@/lib/format";

/** Botón de subida directa con progreso, reintentos y cancelación. */
export function UploadButton({
  kind,
  projectId,
  pieceId,
  label = "Subir archivo",
  accept,
  onUploaded,
}: {
  kind: UploadKind;
  projectId?: string;
  pieceId?: string;
  label?: string;
  accept?: string;
  onUploaded?: (assetId: string) => void | Promise<void>;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function onFile(file: File) {
    setError("");
    setName(file.name);
    abort.current = new AbortController();
    try {
      const { assetId } = await uploadFile(file, { kind, projectId, pieceId }, setProgress, abort.current.signal);
      await onUploaded?.(assetId);
      router.refresh();
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  const pct = progress ? Math.round((progress.sent / Math.max(1, progress.total)) * 100) : 0;
  return (
    <div className="flex flex-col gap-2">
      <input ref={input} type="file" accept={accept} className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} aria-label={label} />
      {progress ? (
        <div className="rounded-md border border-line bg-surface-2 p-3" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="truncate font-medium">{name}</span>
            <button type="button" onClick={() => abort.current?.abort()} className="rounded p-1 text-ink-3 hover:bg-black/5 hover:text-ink" aria-label="Cancelar subida">
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-ink transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[12px] text-ink-3 tabular">
            {progress.phase === "verifying"
              ? "Verificando integridad…"
              : progress.phase === "retrying"
                ? `Conexión inestable, reintentando (${progress.attempt}/5)…`
                : `${fmtBytes(progress.sent)} de ${fmtBytes(progress.total)} · ${pct} %`}
          </p>
        </div>
      ) : (
        <button type="button" className={buttonClass("secondary", "sm")} onClick={() => input.current?.click()}>
          <Upload className="size-4" /> {label}
        </button>
      )}
      {error && <p role="alert" className="text-[13px] text-[var(--tone-danger)]">{error}</p>}
    </div>
  );
}
