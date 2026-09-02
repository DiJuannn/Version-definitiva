import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getLegalDocumentContext, fieldFromForm } from "@/lib/pdf/legal/access";
import { LegalDocumentTemplate } from "@/lib/pdf/legal/LegalDocumentTemplate";
import { LEGAL_TEMPLATES } from "@/lib/pdf/legal/templates";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const context = await getLegalDocumentContext(projectId);
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }
  const { project, organizationName } = context;

  const formData = await request.formData();
  const fields = {
    nombreMenor: fieldFromForm(formData, "nombreMenor"),
    nombreTutor: fieldFromForm(formData, "nombreTutor"),
    dniTutor: fieldFromForm(formData, "dniTutor"),
    relacion: fieldFromForm(formData, "relacion"),
    condiciones: fieldFromForm(formData, "condiciones"),
  };

  const content = LEGAL_TEMPLATES["autorizacion-menor"].buildContent({ project, organizationName, fields });
  const buffer = await renderToBuffer(<LegalDocumentTemplate {...content} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="autorizacion-menor-${project.name}.pdf"`,
    },
  });
}
