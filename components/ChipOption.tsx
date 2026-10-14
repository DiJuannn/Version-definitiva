// Chip seleccionable — radio (una opción) o checkbox (varias) disfrazado de
// chip. Cero JS: el resaltado del chip seleccionado es puro CSS (:has()),
// así que funciona dentro de cualquier <form action={...}> normal, sin
// convertir la página en un Client Component.
export function ChipOption({
  type,
  name,
  value,
  label,
  defaultChecked,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="cursor-pointer rounded-full border border-line bg-bg-raised px-3 py-1.5 font-mono text-[11px] uppercase text-muted transition hover:text-fg has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-bg-raised has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
      <input
        type={type}
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only"
      />
      {label}
    </label>
  );
}
