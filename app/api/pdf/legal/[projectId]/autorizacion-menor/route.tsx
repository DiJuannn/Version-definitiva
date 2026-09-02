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
  const nombreMenor = fieldFromForm(formData, "nombreMenor");
  const nombreTutor = fieldFromForm(formData, "nombreTutor");
  const dniTutor = fieldFromForm(formData, "dniTutor");
  const relacion = fieldFromForm(formData, "relacion");
  const condiciones = fieldFromForm(formData, "condiciones");

  const buffer = await renderToBuffer(
    <LegalDocumentTemplate
      eyebrow="Documento legal orientativo — datos sensibles"
      title="Autorización de menor en pantalla"
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
          label: "Menor",
          fields: [{ label: "Nombre completo", value: nombreMenor }],
        },
        {
          label: "Tutor o tutora legal",
          fields: [
            { label: "Nombre completo", value: nombreTutor },
            { label: "DNI / identificación", value: dniTutor },
            { label: "Relación con el menor", value: relacion },
          ],
        },
      ]}
      bodyText={[
        `Yo, la persona identificada como tutor/a legal arriba, autorizo la participación de la persona menor de edad indicada en el rodaje del proyecto "${project.name}" de ${organizationName || "la productora"}, incluida su aparición en pantalla en el material resultante.`,
        ...(condiciones
          ? [`Condiciones específicas de esta autorización: ${condiciones}`]
          : []),
        "Esta autorización puede revocarse por escrito en cualquier momento antes del uso del material, y queda sujeta en todo caso a la normativa de protección de menores vigente en la jurisdicción correspondiente.",
      ]}
      signatureLines={["Firma del tutor o tutora legal", "Firma de la productora"]}
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="autorizacion-menor-${project.name}.pdf"`,
    },
  });
}
