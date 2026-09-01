import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";

// GET /api/mobile/me — quién ha iniciado sesión en la app y de qué
// productora es. El login en sí no pasa por aquí: la app inicia sesión
// hablando directamente con Supabase Auth (igual que la web), y luego
// usa ese token en todas las llamadas a /api/mobile/**. Este endpoint
// solo confirma que el token es válido y da los datos básicos para
// pintar la pantalla de Inicio y Perfil (incluido el plan de la
// productora — PRO se compra siempre desde la web, nunca dentro de la
// app, así que aquí solo se lee, nunca se cambia).
export async function GET(request: Request) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
    },
    organization: {
      id: profile.organization.id,
      name: profile.organization.name,
      plan: profile.organization.plan,
    },
  });
}
