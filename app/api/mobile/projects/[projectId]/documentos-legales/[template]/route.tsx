import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getMobileLegalDocumentContext } from "@/lib/pdf/legal/access";
import { LegalDocumentTemplate } from "@/lib/pdf/legal/LegalDocumentTemplate";
import { LEGAL_TEMPLATES, type LegalTemplateSlug } from "@/lib/pdf/legal/templates";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function isLegalTemplateSlug(value: string): value is LegalTemplateSlug {
  return value in LEGAL_TEMPLATES;
}

// POST /api/mobile/projects/:projectId/documentos-legales/:template —
// mismo PDF que generan las 5 rutas de la web
// (app/api/pdf/legal/[projectId]/**), con el mismo contenido
// (lib/pdf/legal/templates.ts) — solo cambia cómo se identifica al
// usuario (token en vez de cookie) y que los campos llegan en JSON en
// vez de FormData, porque así es como manda datos el resto de la API
// móvil.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; template: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, template } = await params;
  if (!isLegalTemplateSlug(template)) {
    return NextResponse.json(
      { error: "Plantilla no encontrada." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const context = await getMobileLegalDocumentContext(profile, projectId);
  if ("error" in context) {
    return NextResponse.json(
      { error: context.error },
      { status: context.status, headers: CORS_HEADERS },
    );
  }
  const { project, organizationName } = context;

  const body = await request.json().catch(() => null);
  const fields: Record<string, string> = {};
  if (body && typeof body === "object") {
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") fields[key] = value.trim();
    }
  }

  const content = LEGAL_TEMPLATES[template].buildContent({ project, organizationName, fields });
  const buffer = await renderToBuffer(<LegalDocumentTemplate {...content} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${template}-${project.name}.pdf"`,
    },
  });
}
