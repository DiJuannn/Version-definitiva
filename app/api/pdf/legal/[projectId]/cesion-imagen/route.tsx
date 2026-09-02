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
  const alcance = fieldFromForm(formData, "alcance");
  const duracion = fieldFromForm(formData, "duracion");

  const buffer = await renderToBuffer(
    <LegalDocumentTemplate
      eyebrow="Documento legal orientativo"
      title="Cesión de derechos de imagen"
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
          label: "Persona que cede su imagen",
          fields: [
            { label: "Nombre completo", value: nombre },
            { label: "DNI / identificación", value: dni },
          ],
        },
        {
          label: "Alcance de la cesión",
          fields: [
            { label: "Uso autorizado", value: alcance },
            { label: "Duración", value: duracion },
          ],
        },
      ]}
      bodyText={[
        `La persona abajo firmante autoriza a ${organizationName || "la productora"} a captar, fijar, reproducir y difundir su imagen dentro de la producción audiovisual "${project.name}", conforme al uso y duración especificados arriba, sin que ello suponga contraprestación económica adicional salvo pacto expreso por escrito.`,
        "Esta cesión puede revocarse en cualquier momento por escrito, sin efecto retroactivo sobre el material ya utilizado conforme a los términos aquí descritos.",
      ]}
      signatureLines={["Firma de la persona", "Firma de la productora"]}
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="cesion-imagen-${project.name}.pdf"`,
    },
  });
}
