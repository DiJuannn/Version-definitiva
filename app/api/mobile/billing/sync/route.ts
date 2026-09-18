import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getMobileProfile } from "@/lib/mobile-auth";
import { isRevenueCatConfigured } from "@/lib/revenuecat";
import { syncOrganizationPlan } from "@/lib/revenuecat-sync";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST /api/mobile/billing/sync — la app lo llama justo después de comprar o
// de "Restaurar compras": pregunta a RevenueCat cómo está el plan de la
// organización de quien llama y lo actualiza al momento, sin esperar al aviso
// (webhook), que puede tardar unos segundos. Siempre consulta la organización
// del usuario autenticado, nunca una que venga en la petición.
export async function POST(request: Request) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });
  }
  if (!isRevenueCatConfigured()) {
    return NextResponse.json(
      { error: "Las compras en la app todavía no están activadas." },
      { status: 503, headers: CORS_HEADERS },
    );
  }

  try {
    const result = await syncOrganizationPlan(profile.organizationId);
    return NextResponse.json(
      { plan: result.to ?? null, changed: result.changed, active: result.active ?? false },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "No se pudo comprobar la compra. Inténtalo de nuevo en unos segundos." },
      { status: 502, headers: CORS_HEADERS },
    );
  }
}
