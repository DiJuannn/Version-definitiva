"use client";

import { useTransition } from "react";
import { BREAKDOWN_CATEGORY_LABELS } from "@/lib/labels";

// Selector que guarda solo, en cuanto cambias la opción — pensado para
// corregir elementos que el análisis de IA (u otra persona) clasificó
// mal, sin tener que borrarlos y perder sus escenas vinculadas.
export function BreakdownCategorySelect({
  category,
  action,
}: {
  category: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={category}
      disabled={isPending}
      onChange={(e) => {
        const formData = new FormData();
        formData.set("category", e.target.value);
        startTransition(() => {
          action(formData);
        });
      }}
      aria-label="Categoría (cambiarla mueve el elemento)"
      className="field w-full cursor-pointer border-transparent bg-transparent px-2 py-1 font-mono text-[10px] tracking-widest text-muted uppercase hover:border-line hover:text-fg disabled:opacity-50"
    >
      {Object.entries(BREAKDOWN_CATEGORY_LABELS).map(([value, label]) => (
        <option key={value} value={value} className="bg-bg">
          {label}
        </option>
      ))}
    </select>
  );
}
