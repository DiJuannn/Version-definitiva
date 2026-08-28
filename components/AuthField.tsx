export function AuthField({
  label,
  name,
  type = "text",
  required,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block font-mono text-xs tracking-widest text-muted uppercase"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="mt-2 w-full border border-line bg-transparent px-3 py-2.5 text-sm text-fg outline-none transition-colors focus:border-accent"
      />
    </div>
  );
}
