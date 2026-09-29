"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="max-w-sm text-center">
        <h1 className="font-display text-2xl font-bold">Algo ha fallado</h1>
        <p className="mt-2 text-sm text-ink-2">No se pudo cargar esta pantalla. Si vuelve a pasar, avisa a administración.</p>
        <button type="button" onClick={reset} className="mt-6 inline-flex h-10 items-center rounded-md bg-ink px-4 text-sm font-medium text-white">
          Reintentar
        </button>
      </div>
    </main>
  );
}
