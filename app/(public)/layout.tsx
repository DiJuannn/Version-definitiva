import Link from "next/link";
import { AjoloteLogo } from "@/components/AjoloteLogo";
import { CookieNotice } from "@/components/CookieNotice";
import { CustomCursor } from "@/components/CustomCursor";
import { IntroOverlay } from "@/components/IntroOverlay";
import { getCurrentProfile } from "@/lib/current-user";

const LEGAL_LINKS = [
  { href: "/legal/aviso-legal", label: "Aviso legal" },
  { href: "/legal/privacidad", label: "Privacidad" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/terminos", label: "Términos de uso" },
];

const NAV = [
  { href: "#servicios", label: "Servicios" },
  { href: "#nosotros", label: "Sobre nosotros" },
  { href: "#portfolio", label: "Portfolio" },
  { href: "#contacto", label: "Contacto" },
];

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const profile = await getCurrentProfile();

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
          <div className="flex items-center gap-3">
            {profile?.role === "ADMIN" && (
              <Link
                href="/admin"
                className="hidden font-mono text-xs tracking-widest text-muted uppercase transition-colors hover:text-accent sm:inline"
              >
                Editar web
              </Link>
            )}
            <Link
              href="/taller"
              className="group relative overflow-hidden border border-accent px-4 py-2 font-mono text-xs tracking-widest text-accent uppercase transition-colors hover:text-bg"
            >
              <span className="absolute inset-0 -translate-x-full bg-accent transition-transform duration-300 group-hover:translate-x-0" />
              <span className="relative">Taller</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line px-6 py-8 text-center font-mono text-xs tracking-widest text-muted uppercase">
        <p>© {new Date().getFullYear()} Versión definitiva</p>
        <nav className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {LEGAL_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-accent">
              {item.label}
            </Link>
          ))}
        </nav>
      </footer>
      <CustomCursor />
      <IntroOverlay />
      <CookieNotice />
    </div>
  );
}
