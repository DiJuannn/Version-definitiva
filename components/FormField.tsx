import type { ReactNode } from "react";

// Envuelve un input/select/textarea en un <label> real (asociación implícita,
// sin necesitar id) para que el campo tenga nombre accesible y una etiqueta
// visible que no desaparece al escribir, a diferencia de un placeholder solo.
export function FormField({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="font-mono text-[10px] text-muted">{hint}</span>}
    </label>
  );
}
