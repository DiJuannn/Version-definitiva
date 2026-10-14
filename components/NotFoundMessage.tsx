import Link from "next/link";

// Página de «no existe» con la marca, en español. La usan los not-found de la
// web pública, del Taller y el general (direcciones que no existen).
export function NotFoundMessage({
  backHref = "/",
  backLabel = "Volver al inicio",
  text = "Puede que el enlace esté mal escrito o que la página ya no exista.",
}: {
  backHref?: string;
  backLabel?: string;
  text?: string;
}) {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-start justify-center px-6 py-20">
      <p className="font-mono text-xs tracking-widest text-accent uppercase">Error 404</p>
      <h1 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-5xl">Esta página no existe</h1>
      <p className="mt-4 font-sans text-base leading-relaxed text-muted">{text}</p>
      <Link href={backHref} className="btn btn-primary mt-8">
        {backLabel}
      </Link>
    </div>
  );
}
