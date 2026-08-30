export function PdfLink({ href, label = "Descargar PDF" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-full border border-line px-5 py-2 font-mono text-xs tracking-widest uppercase transition-colors hover:border-accent hover:text-accent print:hidden"
    >
      {label}
    </a>
  );
}
