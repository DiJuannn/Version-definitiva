import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { isRevenueCatConfigured, isValidWebhookAuth } from "@/lib/revenuecat";
import { syncOrganizationPlan } from "@/lib/revenuecat-sync";

type RevenueCatEvent = {
  type?: string;
  app_user_id?: string;
  // Solo en TRANSFER (la compra cambia de usuario): no trae app_user_id.
  transferred_from?: string[];
  transferred_to?: string[];
};

// RevenueCat avisa aquí de cada compra, renovación, cancelación, expiración o
// reembolso hecho dentro de la app móvil. Sin REVENUECAT_WEBHOOK_AUTH y
// REVENUECAT_SECRET_KEY configuradas en Vercel esta ruta está apagada (503),
// así que subirla antes de tener cuenta no cambia nada.
export async function POST(request: Request) {
  if (!isRevenueCatConfigured()) {
    return NextResponse.json({ error: "RevenueCat no está configurado." }, { status: 503 });
  }
  if (!isValidWebhookAuth(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const event = payload?.event as RevenueCatEvent | undefined;
  if (!event?.type) {
    return NextResponse.json({ error: "Aviso inválido." }, { status: 400 });
  }

  // El botón "Send test event" del panel: solo comprueba que la ruta responde.
  if (event.type === "TEST") {
    return NextResponse.json({ received: true, test: true });
  }

  // Los usuarios anónimos de RevenueCat empiezan por "$RCAnonymousID": son
  // compras hechas sin sesión iniciada, no hay organización a la que activar.
  const ids = [
    ...new Set(
      [event.app_user_id, ...(event.transferred_to ?? []), ...(event.transferred_from ?? [])].filter(
        (id): id is string => typeof id === "string" && id.length > 0 && !id.startsWith("$RCAnonymousID"),
      ),
    ),
  ];
  if (ids.length === 0) {
    console.log("Webhook RevenueCat ignorado: sin usuario identificado", { type: event.type });
    return NextResponse.json({ received: true });
  }

  try {
    for (const organizationId of ids) {
      const result = await syncOrganizationPlan(organizationId);
      console.log("Webhook RevenueCat procesado", {
        type: event.type,
        organizationId,
        found: result.found,
        active: result.active,
        from: result.from,
        to: result.changed ? result.to : "sin cambios",
      });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    // 500 para que RevenueCat reintente el aviso más tarde.
    Sentry.captureException(error);
    console.error("Webhook RevenueCat falló", error);
    return NextResponse.json({ error: "Error procesando el aviso." }, { status: 500 });
  }
}
