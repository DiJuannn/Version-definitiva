import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage(props: PageProps<"/entrar">) {
  if (await getCurrentUser()) redirect("/inicio");
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  return (
    <main className="grid min-h-dvh md:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-c-bg p-10 text-c-ink md:flex md:flex-col md:justify-between">
        <Wordmark dark />
        <div className="max-w-md">
          <p className="font-display text-[34px] leading-[1.1] font-bold">
            Del brief a la entrega,
            <br />
            <span className="relative inline-block">
              cada corte
              <svg aria-hidden viewBox="0 0 200 14" className="absolute -bottom-2 left-0 h-3 w-full" preserveAspectRatio="none">
                <path d="M2 9 C 50 3, 120 13, 198 5" stroke="#FFD23F" strokeWidth="5" fill="none" strokeLinecap="round" />
              </svg>
            </span>{" "}
            en su sitio.
          </p>
          <p className="mt-5 text-[15px] leading-relaxed text-c-ink-2">
            Proyectos, montajes, correcciones y aprobaciones de la agencia en un solo lugar.
          </p>
        </div>
        <p className="font-mono text-xs text-c-ink-3">00:00:00:00 — V1</p>
      </section>
      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <Wordmark />
          </div>
          <h1 className="font-display text-2xl font-bold">Entrar</h1>
          <p className="mt-1 mb-6 text-sm text-ink-3">Usa el email con el que te invitó la agencia.</p>
          <LoginForm next={next} />
        </div>
      </section>
    </main>
  );
}

function Wordmark({ dark }: { dark?: boolean }) {
  return (
    <span className={`font-display text-xl font-extrabold tracking-tight ${dark ? "text-c-ink" : "text-ink"}`}>
      Corte<span className="text-marker">/</span>
    </span>
  );
}
