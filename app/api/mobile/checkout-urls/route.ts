import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getCheckoutUrls, buildCheckoutUrl } from "@/lib/lemonsqueezy";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/checkout-urls — los mismos dos enlaces de pago que la
// web (app/app/(dashboard)/organizacion/page.tsx), ya con el email y el
// id de la organización metidos dentro (lib/lemonsqueezy.ts) para que
// el webhook de Lemon Squeezy sepa a qué organización activarle PRO.
export async function GET(request: Request) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const urls = getCheckoutUrls();
  if (!urls) {
    return NextResponse.json({ monthly: null, yearly: null }, { headers: CORS_HEADERS });
  }

  return NextResponse.json(
    {
      monthly: buildCheckoutUrl(urls.monthly, profile.organizationId, profile.email),
      yearly: buildCheckoutUrl(urls.yearly, profile.organizationId, profile.email),
    },
    { headers: CORS_HEADERS },
  );
}
