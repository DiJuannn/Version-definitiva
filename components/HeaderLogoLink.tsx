"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AjoloteLogo } from "@/components/AjoloteLogo";
import { triggerAjoloteSplash } from "@/lib/ajolote-splash-bus";

export function HeaderLogoLink() {
  const router = useRouter();
  const pathname = usePathname();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    triggerAjoloteSplash();
    if (pathname !== "/") {
      setTimeout(() => router.push("/"), 1400);
    }
  }

  return (
    <Link href="/" className="flex items-center gap-2.5" onClick={handleClick}>
      <AjoloteLogo className="h-6 w-auto text-fg" priority />
      <span className="font-mono text-xs tracking-[0.2em] uppercase">
        Versión definitiva
      </span>
    </Link>
  );
}
