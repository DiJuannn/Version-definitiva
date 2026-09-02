import type { LegalFieldGroup } from "@/lib/pdf/legal/LegalDocumentTemplate";

export type LegalTemplateSlug =
  | "permiso-rodaje"
  | "cesion-imagen"
  | "contrato-colaboracion"
  | "autorizacion-menor"
  | "nda";

export type LegalTemplateContent = {
  eyebrow: string;
  title: string;
  fieldGroups: LegalFieldGroup[];
  bodyText: string[];
  signatureLines: string[];
};

type BuildInput = {
  project: { name: string };
  organizationName: string;
  fields: Record<string, string>;
};

// Contenido de las 5 plantillas legales — antes vivía repetido dentro de
// cada ruta de la web (app/api/pdf/legal/[projectId]/**). Se extrajo
// aquí para que la app móvil pueda generar el mismo PDF, con el mismo
// texto, sin duplicarlo (ver app/api/mobile/projects/[projectId]/documentos-legales/[template]/route.tsx).
export const LEGAL_TEMPLATES: Record<
  LegalTemplateSlug,
  { title: string; buildContent: (input: BuildInput) => LegalTemplateContent }
> = {
  "permiso-rodaje": {
    title: "Permiso de rodaje",
    buildContent({ project, organizationName, fields }) {
      const { localizacion, direccion, fechas, horario, nombreAutoriza, dniAutoriza, condiciones } = fields;
      return {
        eyebrow: "Documento legal orientativo",
        title: "Permiso de rodaje",
        fieldGroups: [
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
              { label: "Localización", value: localizacion ?? "" },
              { label: "Dirección", value: direccion ?? "" },
              { label: "Fechas de rodaje", value: fechas ?? "" },
              { label: "Horario", value: horario ?? "" },
            ],
          },
          {
            label: "Quien autoriza",
            fields: [
              { label: "Nombre", value: nombreAutoriza ?? "" },
              { label: "DNI / identificación", value: dniAutoriza ?? "" },
            ],
          },
        ],
        bodyText: [
          `Por la presente, ${organizationName || "la productora"} solicita autorización para realizar labores de grabación audiovisual del proyecto "${project.name}" en la localización indicada, en las fechas y el horario especificados arriba. El equipo se compromete a respetar en todo momento las condiciones establecidas por quien autoriza y a dejar el espacio en las mismas condiciones en que se encontraba antes del rodaje.`,
          ...(condiciones ? [`Condiciones especiales: ${condiciones}`] : []),
        ],
        signatureLines: ["Firma de la productora", "Firma de quien autoriza"],
      };
    },
  },

  "cesion-imagen": {
    title: "Cesión de derechos de imagen",
    buildContent({ project, organizationName, fields }) {
      const { nombre, dni, alcance, duracion } = fields;
      return {
        eyebrow: "Documento legal orientativo",
        title: "Cesión de derechos de imagen",
        fieldGroups: [
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
              { label: "Nombre completo", value: nombre ?? "" },
              { label: "DNI / identificación", value: dni ?? "" },
            ],
          },
          {
            label: "Alcance de la cesión",
            fields: [
              { label: "Uso autorizado", value: alcance ?? "" },
              { label: "Duración", value: duracion ?? "" },
            ],
          },
        ],
        bodyText: [
          `La persona abajo firmante autoriza a ${organizationName || "la productora"} a captar, fijar, reproducir y difundir su imagen dentro de la producción audiovisual "${project.name}", conforme al uso y duración especificados arriba, sin que ello suponga contraprestación económica adicional salvo pacto expreso por escrito.`,
          "Esta cesión puede revocarse en cualquier momento por escrito, sin efecto retroactivo sobre el material ya utilizado conforme a los términos aquí descritos.",
        ],
        signatureLines: ["Firma de la persona", "Firma de la productora"],
      };
    },
  },

  "contrato-colaboracion": {
    title: "Contrato de colaboración",
    buildContent({ project, organizationName, fields }) {
      const { nombre, dni, rol, fechas, remuneracion, condiciones } = fields;
      return {
        eyebrow: "Documento legal orientativo",
        title: "Contrato de colaboración",
        fieldGroups: [
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
              { label: "Nombre completo", value: nombre ?? "" },
              { label: "DNI / identificación", value: dni ?? "" },
              { label: "Rol / función", value: rol ?? "" },
            ],
          },
          {
            label: "Condiciones",
            fields: [
              { label: "Fechas de colaboración", value: fechas ?? "" },
              { label: "Remuneración / contraprestación", value: remuneracion ?? "" },
            ],
          },
        ],
        bodyText: [
          `Mediante este documento, ${organizationName || "la productora"} y la persona arriba identificada acuerdan su colaboración en el proyecto "${project.name}" en el rol y las fechas especificados, a cambio de la contraprestación indicada.`,
          ...(condiciones ? [`Condiciones adicionales: ${condiciones}`] : []),
          "Ambas partes se comprometen a cumplir con los horarios y condiciones de trabajo acordados y a tratar cualquier material no publicado del proyecto con la debida confidencialidad.",
        ],
        signatureLines: ["Firma de la persona colaboradora", "Firma de la productora"],
      };
    },
  },

  "autorizacion-menor": {
    title: "Autorización de menor en pantalla",
    buildContent({ project, organizationName, fields }) {
      const { nombreMenor, nombreTutor, dniTutor, relacion, condiciones } = fields;
      return {
        eyebrow: "Documento legal orientativo — datos sensibles",
        title: "Autorización de menor en pantalla",
        fieldGroups: [
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
            fields: [{ label: "Nombre completo", value: nombreMenor ?? "" }],
          },
          {
            label: "Tutor o tutora legal",
            fields: [
              { label: "Nombre completo", value: nombreTutor ?? "" },
              { label: "DNI / identificación", value: dniTutor ?? "" },
              { label: "Relación con el menor", value: relacion ?? "" },
            ],
          },
        ],
        bodyText: [
          `Yo, la persona identificada como tutor/a legal arriba, autorizo la participación de la persona menor de edad indicada en el rodaje del proyecto "${project.name}" de ${organizationName || "la productora"}, incluida su aparición en pantalla en el material resultante.`,
          ...(condiciones ? [`Condiciones específicas de esta autorización: ${condiciones}`] : []),
          "Esta autorización puede revocarse por escrito en cualquier momento antes del uso del material, y queda sujeta en todo caso a la normativa de protección de menores vigente en la jurisdicción correspondiente.",
        ],
        signatureLines: ["Firma del tutor o tutora legal", "Firma de la productora"],
      };
    },
  },

  nda: {
    title: "Acuerdo de confidencialidad",
    buildContent({ project, organizationName, fields }) {
      const { nombre, dni, duracion } = fields;
      return {
        eyebrow: "Documento legal orientativo",
        title: "Acuerdo de confidencialidad",
        fieldGroups: [
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
              { label: "Nombre completo", value: nombre ?? "" },
              { label: "DNI / identificación", value: dni ?? "" },
              { label: "Duración del acuerdo", value: duracion ?? "" },
            ],
          },
        ],
        bodyText: [
          `La persona abajo firmante se compromete a mantener la confidencialidad de todo el material, guion, información de producción y cualquier otro contenido no publicado del proyecto "${project.name}" de ${organizationName || "la productora"} al que tenga acceso, y a no divulgarlo a terceros sin autorización expresa por escrito.`,
          "Esta obligación de confidencialidad se mantiene vigente durante el tiempo indicado arriba, incluso después de finalizar su relación con el proyecto.",
        ],
        signatureLines: ["Firma de la persona firmante", "Firma de la productora"],
      };
    },
  },
};
