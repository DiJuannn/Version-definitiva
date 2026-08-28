import Link from "next/link";
import { AjoloteLogo } from "@/components/AjoloteLogo";

const NAV = [
  { href: "#servicios", label: "Servicios" },
  { href: "#portfolio", label: "Portfolio" },
  { href: "#contacto", label: "Contacto" },
];

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <AjoloteLogo className="h-9 w-auto" playOnce={false} />
            <span className="font-display text-lg tracking-tight">
              Versión definitiva
            </span>
          </Link>
          <nav className="hidden gap-8 font-sans text-sm sm:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-ink/70 transition-colors hover:text-accent"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-ink/10 px-6 py-10 text-center font-sans text-sm text-ink/60">
        © {new Date().getFullYear()} Versión definitiva. Todos los derechos
        reservados.
      </footer>
    </div>
  );
}
