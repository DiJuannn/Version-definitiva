"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

/** Pide al servidor una URL firmada de descarga (queda registrada) y la abre. */
export function DownloadButton({ assetId, linkId, label = "Descargar", variant = "secondary" }: { assetId: string; linkId?: string | null; label?: string; variant?: "secondary" | "primary" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function go() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/downloads${linkId ? `?link=${linkId}` : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo descargar");
      window.location.assign(body.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={go} disabled={busy} className={buttonClass(variant, "sm")}>
        <Download className="size-4" /> {busy ? "Preparando…" : label}
      </button>
      {error && <span role="alert" className="mt-1 text-[12px] text-[var(--tone-danger)]">{error}</span>}
    </span>
  );
}
