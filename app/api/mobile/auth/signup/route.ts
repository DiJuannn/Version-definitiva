import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { signUpCore } from "@/lib/auth-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST /api/mobile/auth/signup — crear cuenta desde la app. Misma
// lógica que el registro de la web (signUpCore en lib/auth-core.ts),
// solo cambia que aquí no hay cookies de navegador: si Supabase ya deja
// entrar sin confirmar email, se devuelven los tokens de sesión para
// que la app inicie sesión directamente; si hace falta confirmar el
// email primero, se avisa con `needsEmailConfirmation`.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { error: "Datos inválidos." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const origin = request.headers.get("origin") || "https://version-definitiva.vercel.app";

  const result = await signUpCore(supabase, body, `${origin}/app/login?confirmed=1`);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400, headers: CORS_HEADERS });
  }

  return NextResponse.json(
    { session: result.session, needsEmailConfirmation: !result.session },
    { headers: CORS_HEADERS },
  );
}
