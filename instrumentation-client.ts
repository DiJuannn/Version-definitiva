import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // No hacemos "session replay" — no queremos grabar pantallas de los
  // usuarios, solo errores con su contexto (ver setUser en lib/current-user.ts).
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
