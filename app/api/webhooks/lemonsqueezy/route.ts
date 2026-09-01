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
  const incomingSubscriptionId: string | undefined = payload?.data?.id
    ? String(payload.data.id)
    : undefined;
  const plan = status && isActiveSubscriptionStatus(status) ? "PRO" : "FREE";

  console.log("Webhook Lemon Squeezy procesado", {
    eventName,
    organizationId,
    subscriptionId: incomingSubscriptionId,
    status,
    plan,
  });

  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { lemonSqueezySubscriptionId: true },
    });
    if (!org) throw new Error("organización no encontrada");

    // Si el evento es de una suscripción distinta a la que tenemos
    // guardada (por ejemplo, una de prueba antigua ya cancelada que manda
    // un aviso tardío), solo se acepta si es una NUEVA suscripción activa
    // — nunca se deja que baje el plan de una suscripción que ya no es la
    // vigente. Esto es justo lo que causó que el plan PRO se desactivara
    // solo sin que nadie tocara nada.
    const isCurrentSubscription = org.lemonSqueezySubscriptionId === incomingSubscriptionId;
    const isNewActiveSubscription = !isCurrentSubscription && plan === "PRO";
    if (!isCurrentSubscription && !isNewActiveSubscription) {
      console.log("Webhook Lemon Squeezy ignorado: evento de una suscripción que ya no es la vigente", {
        organizationId,
        storedSubscriptionId: org.lemonSqueezySubscriptionId,
        incomingSubscriptionId,
      });
      return NextResponse.json({ received: true });
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan,
        lemonSqueezyCustomerId: attributes.customer_id
          ? String(attributes.customer_id)
          : undefined,
        lemonSqueezySubscriptionId: incomingSubscriptionId,
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
