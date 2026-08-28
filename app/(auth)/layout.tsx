import Link from "next/link";
import type { ReactNode } from "react";
import { AjoloteLogo } from "@/components/AjoloteLogo";

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
    </div>
  );
}
