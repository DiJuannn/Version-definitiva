/**
 * Subida por trozos reanudable (cliente).
 * - Cada trozo lleva su SHA-256 y el servidor lo verifica.
 * - Reintentos con espera exponencial; si el servidor responde 409 con otro
 *   offset, se continúa desde ese punto.
 * - Si se vuelve a elegir el mismo archivo (nombre+tamaño+fecha), se reanuda
 *   la subida pendiente en lugar de empezar de cero.
 */
export type UploadKind = "PREVIEW" | "DELIVERABLE" | "REFERENCE" | "SOURCE";

export type UploadProgress = { sent: number; total: number; phase: "hashing" | "uploading" | "verifying" | "retrying"; attempt?: number };

type StartParams = {
  kind: UploadKind;
  pieceId?: string;
  projectId?: string;
  label?: string;
  meta?: { durationMs?: number | null; width?: number | null; height?: number | null };
};

const RESUME_KEY = "corte:uploads";

function fingerprint(f: File, p: StartParams) {
  return `${p.kind}:${p.pieceId ?? p.projectId}:${f.name}:${f.size}:${f.lastModified}`;
}

function loadResume(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(RESUME_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveResume(map: Record<string, string>) {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify(map));
  } catch {
    /* almacenamiento no disponible: se pierde solo la reanudación */
  }
}

async function sha256Hex(buf: ArrayBuffer) {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function jsonOrThrow(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error ?? `Error ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return body;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function uploadFile(
  file: File,
  params: StartParams,
  onProgress: (p: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<{ assetId: string; sha256: string }> {
  const fp = fingerprint(file, params);
  const resume = loadResume();
  let assetId: string | null = resume[fp] ?? null;
  let offset = 0;

  if (assetId) {
    const st = await fetch(`/api/uploads/${assetId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (st && st.status === "UPLOADING") offset = st.uploadedBytes;
    else if (st && st.status === "READY") {
      delete resume[fp];
      saveResume(resume);
      assetId = null;
    } else assetId = null;
  }
  let chunkSize = 8 * 1024 * 1024;
  if (!assetId) {
    const started = await jsonOrThrow(
      await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: params.kind,
          pieceId: params.pieceId,
          projectId: params.projectId,
          label: params.label,
          filename: file.name,
          sizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
          ...params.meta,
        }),
        signal,
      }),
    );
    assetId = started.assetId as string;
    chunkSize = started.chunkSize ?? chunkSize;
    resume[fp] = assetId;
    saveResume(resume);
  }

  while (offset < file.size) {
    if (signal?.aborted) throw new DOMException("Subida cancelada", "AbortError");
    const end = Math.min(offset + chunkSize, file.size);
    const buf = await file.slice(offset, end).arrayBuffer();
    const sha = await sha256Hex(buf);
    let attempt = 0;
    for (;;) {
      try {
        const res = await fetch(`/api/uploads/${assetId}?offset=${offset}`, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream", "x-chunk-sha256": sha },
          body: buf,
          signal,
        });
        if (res.status === 409) {
          const body = await res.json().catch(() => ({}));
          const m = /offset:(\d+)/.exec(body.error ?? "");
          if (m) {
            offset = Number(m[1]);
            break;
          }
        }
        const body = await jsonOrThrow(res);
        offset = body.uploadedBytes;
        break;
      } catch (err) {
        if (signal?.aborted) throw err;
        const status = (err as { status?: number }).status;
        if (status && status < 500 && status !== 400 && status !== 408 && status !== 429) throw err;
        attempt++;
        if (attempt > 5) throw new Error("La conexión falló varias veces. Vuelve a elegir el archivo para reanudar donde se quedó.");
        onProgress({ sent: offset, total: file.size, phase: "retrying", attempt });
        await sleep(Math.min(16000, 1000 * 2 ** (attempt - 1)));
      }
    }
    onProgress({ sent: offset, total: file.size, phase: "uploading" });
  }
  onProgress({ sent: file.size, total: file.size, phase: "verifying" });
  const done = await jsonOrThrow(await fetch(`/api/uploads/${assetId}/complete`, { method: "POST", signal }));
  delete resume[fp];
  saveResume(resume);
  return { assetId, sha256: done.sha256 };
}

/** Lee duración y dimensiones con el propio navegador (no es un análisis del pipeline). */
export function readVideoMeta(file: File): Promise<{ durationMs: number | null; width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const done = (r: { durationMs: number | null; width: number | null; height: number | null }) => {
      URL.revokeObjectURL(url);
      resolve(r);
    };
    v.onloadedmetadata = () => {
      const d = Number.isFinite(v.duration) ? Math.round(v.duration * 1000) : null;
      done({ durationMs: d, width: v.videoWidth || null, height: v.videoHeight || null });
    };
    v.onerror = () => done({ durationMs: null, width: null, height: null });
    setTimeout(() => done({ durationMs: null, width: null, height: null }), 15000);
    v.src = url;
  });
}
