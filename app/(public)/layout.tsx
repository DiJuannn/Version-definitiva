import Link from "next/link";
import { AjoloteLogo } from "@/components/AjoloteLogo";

const NAV = [
  { href: "#servicios", label: "Servicios" },
  { href: "#nosotros", label: "Sobre nosotros" },
  { href: "#portfolio", label: "Portfolio" },
  { href: "#contacto", label: "Contacto" },
];

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="fixed top-0 z-40 w-full border-b border-line/60 bg-bg/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <AjoloteLogo className="h-6 w-auto text-fg" priority />
            <span className="font-mono text-xs tracking-[0.2em] uppercase">
              Versión definitiva
            </span>
          </Link>
          <nav className="hidden gap-8 font-mono text-xs tracking-widest uppercase sm:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="relative text-muted transition-colors after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-accent after:transition-all after:duration-300 hover:text-fg hover:after:w-full"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <Link
            href="/login"
            className="group relative overflow-hidden border border-accent px-4 py-2 font-mono text-xs tracking-widest text-accent uppercase transition-colors hover:text-bg"
          >
            <span className="absolute inset-0 -translate-x-full bg-accent transition-transform duration-300 group-hover:translate-x-0" />
            <span className="relative">Taller</span>
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line px-6 py-8 text-center font-mono text-xs tracking-widest text-muted uppercase">
        © {new Date().getFullYear()} Versión definitiva
      </footer>
    </div>
  );
}
