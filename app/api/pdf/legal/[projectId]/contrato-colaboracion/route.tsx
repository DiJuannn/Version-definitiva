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
  const rol = fieldFromForm(formData, "rol");
  const fechas = fieldFromForm(formData, "fechas");
  const remuneracion = fieldFromForm(formData, "remuneracion");
  const condiciones = fieldFromForm(formData, "condiciones");

  const buffer = await renderToBuffer(
    <LegalDocumentTemplate
      eyebrow="Documento legal orientativo"
      title="Contrato de colaboración"
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
          label: "Persona colaboradora",
          fields: [
            { label: "Nombre completo", value: nombre },
            { label: "DNI / identificación", value: dni },
            { label: "Rol / función", value: rol },
          ],
        },
        {
          label: "Condiciones",
          fields: [
            { label: "Fechas de colaboración", value: fechas },
            { label: "Remuneración / contraprestación", value: remuneracion },
          ],
        },
      ]}
      bodyText={[
        `Mediante este documento, ${organizationName || "la productora"} y la persona arriba identificada acuerdan su colaboración en el proyecto "${project.name}" en el rol y las fechas especificados, a cambio de la contraprestación indicada.`,
        ...(condiciones ? [`Condiciones adicionales: ${condiciones}`] : []),
        "Ambas partes se comprometen a cumplir con los horarios y condiciones de trabajo acordados y a tratar cualquier material no publicado del proyecto con la debida confidencialidad.",
      ]}
      signatureLines={["Firma de la persona colaboradora", "Firma de la productora"]}
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="contrato-colaboracion-${project.name}.pdf"`,
    },
  });
}
