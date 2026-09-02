import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getLegalDocumentContext, fieldFromForm } from "@/lib/pdf/legal/access";
import { LegalDocumentTemplate } from "@/lib/pdf/legal/LegalDocumentTemplate";

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
  const nombre = fieldFromForm(formData, "nombre");
  const dni = fieldFromForm(formData, "dni");
  const duracion = fieldFromForm(formData, "duracion");

  const buffer = await renderToBuffer(
    <LegalDocumentTemplate
      eyebrow="Documento legal orientativo"
      title="Acuerdo de confidencialidad"
      fieldGroups={[
        {
          label: "Proyecto",
          fields: [
            { label: "Proyecto", value: project.name },
            { label: "Productora", value: organizationName },
            { label: "Fecha del documento", value: new Date().toLocaleDateString("es-ES") },
          ],
        },
        {
          label: "Persona firmante",
          fields: [
            { label: "Nombre completo", value: nombre },
            { label: "DNI / identificación", value: dni },
            { label: "Duración del acuerdo", value: duracion },
          ],
        },
      ]}
      bodyText={[
        `La persona abajo firmante se compromete a mantener la confidencialidad de todo el material, guion, información de producción y cualquier otro contenido no publicado del proyecto "${project.name}" de ${organizationName || "la productora"} al que tenga acceso, y a no divulgarlo a terceros sin autorización expresa por escrito.`,
        "Esta obligación de confidencialidad se mantiene vigente durante el tiempo indicado arriba, incluso después de finalizar su relación con el proyecto.",
      ]}
      signatureLines={["Firma de la persona firmante", "Firma de la productora"]}
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="nda-${project.name}.pdf"`,
    },
  });
}
