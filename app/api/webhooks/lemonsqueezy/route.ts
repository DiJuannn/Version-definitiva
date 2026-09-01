import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLemonSqueezySignature, isActiveSubscriptionStatus } from "@/lib/lemonsqueezy";

// Lemon Squeezy manda aquí cada cambio de la suscripción PRO (alta, baja,
// impago...). El cuerpo hay que leerlo en crudo (antes de parsear el JSON)
// porque la firma se calcula sobre el texto exacto que envían.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  if (!verifyLemonSqueezySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const eventName: string | undefined = payload?.meta?.event_name;
  const organizationId: string | undefined = payload?.meta?.custom_data?.organization_id;

  if (!eventName?.startsWith("subscription_") || !organizationId) {
    // Pasa si el checkout se abrió sin el enlace que genera la app (sin
    // el organization_id en la URL) — no hay a quién activarle el plan.
    console.log("Webhook Lemon Squeezy ignorado: falta organization_id o evento no es de suscripción", {
      eventName,
      organizationId,
    });
    return NextResponse.json({ received: true });
  }

  const attributes = payload?.data?.attributes ?? {};
  const status: string | undefined = attributes.status;
  const plan = status && isActiveSubscriptionStatus(status) ? "PRO" : "FREE";

  console.log("Webhook Lemon Squeezy procesado", {
    eventName,
    organizationId,
    subscriptionId: payload?.data?.id,
    status,
    plan,
  });

  try {
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan,
        lemonSqueezyCustomerId: attributes.customer_id
          ? String(attributes.customer_id)
          : undefined,
        lemonSqueezySubscriptionId: payload?.data?.id ? String(payload.data.id) : undefined,
      },
    });
  } catch (error) {
    // La organización del custom_data no existe (dato manipulado o de
    // pruebas) — no hay nada que actualizar, pero no debe romper el
    // webhook ni hacer que Lemon Squeezy lo reintente sin parar.
    console.error("Webhook Lemon Squeezy: organización no encontrada", organizationId, error);
  }

  return NextResponse.json({ received: true });
}
