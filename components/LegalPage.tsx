import Link from "next/link";
import type { ReactNode } from "react";

const LEGAL_NAV = [
  { href: "/legal/aviso-legal", label: "Aviso legal" },
  { href: "/legal/privacidad", label: "Privacidad" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/terminos", label: "Términos de uso" },
];

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 pt-32 pb-24">
      <Link
        href="/"
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        ← Versión definitiva
      </Link>
      <h1 className="mt-4 font-display text-3xl font-black uppercase sm:text-5xl">
        {title}
      </h1>
      {updatedAt && (
        <p className="mt-2 font-mono text-xs text-muted">
          Última actualización: {updatedAt}
        </p>
      )}
      <div className="prose-legal mt-10 space-y-6 font-sans text-sm leading-relaxed text-muted">
        {children}
      </div>
      <nav className="mt-16 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-6 font-mono text-xs tracking-widest text-muted uppercase">
        {LEGAL_NAV.map((item) => (
          <Link key={item.href} href={item.href} className="hover:text-accent">
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function LegalHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="!mt-10 font-display text-lg font-bold text-fg uppercase">
      {children}
    </h2>
  );
}

export function PendingNotice({ what }: { what: string }) {
  return (
    <p className="border border-accent bg-accent/5 px-4 py-3 font-mono text-xs text-accent">
      ⚠ Pendiente de completar: {what}. Rellénalo en{" "}
      <Link href="/admin" className="underline hover:opacity-80">
        Editar web → Datos legales
      </Link>{" "}
      antes de publicar la web de verdad.
    </p>
  );
}
