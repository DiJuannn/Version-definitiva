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
  const localizacion = fieldFromForm(formData, "localizacion");
  const direccion = fieldFromForm(formData, "direccion");
  const fechas = fieldFromForm(formData, "fechas");
  const horario = fieldFromForm(formData, "horario");
  const nombreAutoriza = fieldFromForm(formData, "nombreAutoriza");
  const dniAutoriza = fieldFromForm(formData, "dniAutoriza");
  const condiciones = fieldFromForm(formData, "condiciones");

  const buffer = await renderToBuffer(
    <LegalDocumentTemplate
      eyebrow="Documento legal orientativo"
      title="Permiso de rodaje"
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
          label: "Localización y fechas de rodaje",
          fields: [
            { label: "Localización", value: localizacion },
            { label: "Dirección", value: direccion },
            { label: "Fechas de rodaje", value: fechas },
            { label: "Horario", value: horario },
          ],
        },
        {
          label: "Quien autoriza",
          fields: [
            { label: "Nombre", value: nombreAutoriza },
            { label: "DNI / identificación", value: dniAutoriza },
          ],
        },
      ]}
      bodyText={[
        `Por la presente, ${organizationName || "la productora"} solicita autorización para realizar labores de grabación audiovisual del proyecto "${project.name}" en la localización indicada, en las fechas y el horario especificados arriba. El equipo se compromete a respetar en todo momento las condiciones establecidas por quien autoriza y a dejar el espacio en las mismas condiciones en que se encontraba antes del rodaje.`,
        ...(condiciones ? [`Condiciones especiales: ${condiciones}`] : []),
      ]}
      signatureLines={["Firma de la productora", "Firma de quien autoriza"]}
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="permiso-rodaje-${project.name}.pdf"`,
    },
  });
}
