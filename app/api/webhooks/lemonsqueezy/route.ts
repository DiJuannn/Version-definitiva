import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLemonSqueezySignature, isActiveSubscriptionStatus } from "@/lib/lemonsqueezy";
import * as Sentry from "@sentry/nextjs";

// Lemon Squeezy manda aquí tanto los cambios de la suscripción PRO (alta,
// baja, impago...) como los pagos únicos del plan PRO de por vida (pedido
// pagado, reembolsado...). El cuerpo hay que leerlo en crudo (antes de
// parsear el JSON) porque la firma se calcula sobre el texto exacto que
// envían.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  if (!verifyLemonSqueezySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const eventName: string | undefined = payload?.meta?.event_name;
  const organizationId: string | undefined = payload?.meta?.custom_data?.organization_id;

  if (!organizationId) {
    // Pasa si el checkout se abrió sin el enlace que genera la app (sin
    // el organization_id en la URL) — no hay a quién activarle el plan.
    console.log("Webhook Lemon Squeezy ignorado: falta organization_id", { eventName });
    return NextResponse.json({ received: true });
  }

  if (eventName === "order_created" || eventName === "order_refunded") {
    return handleLifetimeOrderEvent(eventName, organizationId, payload);
  }

  if (!eventName?.startsWith("subscription_")) {
    console.log("Webhook Lemon Squeezy ignorado: evento no reconocido", { eventName, organizationId });
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
    // Un fallo aquí significa que una suscripción de pago no se activó o
    // no se desactivó correctamente — merece una alerta, no solo el log.
    Sentry.captureException(error, {
      tags: { area: "billing", action: "lemonsqueezy-webhook" },
      extra: { organizationId, eventName, incomingSubscriptionId, plan },
    });
  }

  return NextResponse.json({ received: true });
}

// Pago único del plan PRO de por vida — no es una suscripción, así que no
// tiene estado activo/cancelado ni se renueva. "order_created" con
// status "paid" lo activa; "order_refunded" lo desactiva, pero SOLO si la
// organización sigue en PRO_LIFETIME (si mientras tanto se pasó a una
// suscripción normal, un reembolso tardío del pago único no debe tocarla).
async function handleLifetimeOrderEvent(
  eventName: "order_created" | "order_refunded",
  organizationId: string,
  payload: {
    data?: { id?: string | number; attributes?: { status?: string; customer_id?: string | number } };
  },
) {
  const attributes = payload?.data?.attributes ?? {};
  const status = attributes.status;

  console.log("Webhook Lemon Squeezy (pago único) procesado", {
    eventName,
    organizationId,
    orderId: payload?.data?.id,
    status,
  });

  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    });
    if (!org) throw new Error("organización no encontrada");

    if (eventName === "order_created") {
      if (status !== "paid") {
        console.log("Webhook Lemon Squeezy ignorado: pedido no pagado todavía", { organizationId, status });
        return NextResponse.json({ received: true });
      }
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          plan: "PRO_LIFETIME",
          lemonSqueezyCustomerId: attributes.customer_id ? String(attributes.customer_id) : undefined,
        },
      });
    } else {
      if (org.plan !== "PRO_LIFETIME") {
        console.log("Webhook Lemon Squeezy ignorado: reembolso de una organización que ya no es PRO_LIFETIME", {
          organizationId,
          currentPlan: org.plan,
        });
        return NextResponse.json({ received: true });
      }
      await prisma.organization.update({
        where: { id: organizationId },
        data: { plan: "FREE" },
      });
    }
  } catch (error) {
    console.error("Webhook Lemon Squeezy (pago único): fallo procesando el evento", organizationId, error);
    Sentry.captureException(error, {
      tags: { area: "billing", action: "lemonsqueezy-webhook-order" },
      extra: { organizationId, eventName, status },
    });
  }

  return NextResponse.json({ received: true });
}
