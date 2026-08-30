import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AjoloteLogo } from "@/components/AjoloteLogo";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const LEGAL_LINKS = [
  { href: "/legal/aviso-legal", label: "Aviso legal" },
  { href: "/legal/privacidad", label: "Privacidad" },
  { href: "/legal/cookies", label: "Cookies" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <Link href="/" className="mb-10 flex items-center gap-2.5">
        <AjoloteLogo className="h-8 w-auto text-fg" />
        <span className="font-mono text-xs tracking-[0.2em] uppercase">
          Versión definitiva
        </span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <nav className="mt-12 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-mono text-[11px] tracking-widest text-muted uppercase">
        {LEGAL_LINKS.map((item) => (
          <Link key={item.href} href={item.href} className="hover:text-accent">
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
