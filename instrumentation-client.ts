import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // No hacemos "session replay" — no queremos grabar pantallas de los
  // usuarios, solo errores con su contexto (ver setUser en lib/current-user.ts).
  //
  // Ruido de conexión del propio dispositivo del usuario (el móvil pierde
  // cobertura a mitad de una navegación, etc.) — no son bugs de la app,
  // solo huecos de red pasajeros que no podemos arreglar desde el código.
  // Mismo mensaje, distinto texto según el navegador.
  ignoreErrors: [
    "Failed to fetch",
    "NetworkError when attempting to fetch resource",
    "Load failed",
    "The network connection was lost",
    "cancelled",
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
