import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="max-w-sm text-center">
        <p className="font-mono text-sm text-ink-3">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold">No encontramos esta página</h1>
        <p className="mt-2 text-sm text-ink-2">Puede que no exista o que no tengas acceso con esta cuenta.</p>
        <Link href="/inicio" className="mt-6 inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-medium text-white">
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
