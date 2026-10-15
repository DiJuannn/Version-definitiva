"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadProjectCover } from "@/lib/actions/project-details";

// Cambiar la imagen del cartel: un botón discreto sobre el propio cartel.
export function CoverUpload({ projectId, hasCover }: { projectId: string; hasCover: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const send = (fd: FormData) =>
    start(async () => {
      const res = await uploadProjectCover(projectId, fd);
      setError(res.error ?? null);
      if (!res.error) router.refresh();
    });

  return (
    // Sin imagen, el título del cartel va arriba: el botón, abajo.
    <div className={`absolute right-2.5 flex flex-col items-end gap-1.5 ${hasCover ? "top-2.5" : "bottom-2.5"}`}>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={pending}
          className="rounded-full bg-black/60 px-3 py-1.5 font-mono text-[10px] tracking-widest text-white uppercase backdrop-blur hover:bg-black/80"
        >
          {pending ? "Subiendo…" : hasCover ? "Cambiar imagen" : "+ Imagen del cartel"}
        </button>
        {hasCover && !pending && (
          <button
            type="button"
            onClick={() => {
              const fd = new FormData();
              fd.set("remove", "1");
              send(fd);
            }}
            aria-label="Quitar la imagen del cartel"
            className="rounded-full bg-black/60 px-2.5 py-1.5 font-mono text-[10px] text-white backdrop-blur hover:bg-black/80"
          >
            ×
          </button>
        )}
      </div>
      {error && <p className="rounded bg-black/80 px-2 py-1 font-sans text-[12px] text-danger">{error}</p>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const fd = new FormData();
          fd.set("file", file);
          send(fd);
          e.target.value = "";
        }}
      />
    </div>
  );
}
