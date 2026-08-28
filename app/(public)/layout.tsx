import { HeaderLogoLink } from "@/components/HeaderLogoLink";

const NAV = [
  { href: "#servicios", label: "Servicios" },
  { href: "#nosotros", label: "Sobre nosotros" },
  { href: "#portfolio", label: "Portfolio" },
];

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="fixed top-0 z-40 w-full border-b border-line/60 bg-bg/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <HeaderLogoLink />
          <nav className="hidden gap-8 font-mono text-xs tracking-widest uppercase sm:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-muted transition-colors hover:text-accent"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <a
            href="#contacto"
            className="font-mono text-xs tracking-widest text-fg uppercase transition-colors hover:text-accent"
          >
            Contacto
          </a>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line px-6 py-8 text-center font-mono text-xs tracking-widest text-muted uppercase">
        © {new Date().getFullYear()} Versión definitiva
      </footer>
    </div>
  );
}
