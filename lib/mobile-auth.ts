import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { getProfileByUserId, type Profile } from "@/lib/current-user";

// La web identifica al usuario por la cookie de sesión que deja
// @supabase/ssr (lib/supabase/server.ts). La app móvil no tiene cookies
// de navegador: en su lugar manda el access_token de Supabase Auth (el
// mismo que genera al hacer login con el SDK de Supabase para React
// Native) en la cabecera Authorization. Verificamos ese token contra
// Supabase y, a partir de ahí, es la misma consulta que en la web
// (getProfileByUserId) — ninguna regla de negocio se duplica.
//
// Se crea un cliente nuevo en cada llamada (en vez de una instancia
// compartida) a propósito: este cliente no lleva sesión propia, solo
// se usa para pedirle a Supabase que valide un token ajeno, así que no
// hay estado que merezca la pena reutilizar entre peticiones.
function createTokenClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function getMobileProfile(request: Request): Promise<Profile | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const supabase = createTokenClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return null;

  Sentry.setUser({ id: user.id });

  return getProfileByUserId(user.id);
}
