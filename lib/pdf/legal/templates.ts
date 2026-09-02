import type { LegalSignature } from "@/lib/pdf/legal/LegalDocumentTemplate";

export type LegalTemplateSlug =
  | "permiso-rodaje"
  | "cesion-imagen"
  | "contrato-colaboracion"
  | "autorizacion-menor"
  | "nda";

export type LegalTemplateContent = {
  letterhead: string;
  caution?: string;
  title: string;
  paragraphs: string[];
  signatures: LegalSignature[];
  disclaimer: string;
};

type BuildInput = {
  project: { name: string };
  organizationName: string;
  fields: Record<string, string>;
};

const DISCLAIMER =
  "Esta plantilla es orientativa y no sustituye asesoría legal profesional. La validez y los requisitos de este documento varían según el país y la jurisdicción — revísalo con un profesional antes de usarlo de forma vinculante.";

// Los campos libres (condiciones, remuneración...) se insertan justo
// antes de un punto final ya escrito en la plantilla — sin esto, si
// alguien termina su texto con un punto, el PDF sale con "..".
function cleanFields(fields: Record<string, string>): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    cleaned[key] = value.trim().replace(/[.\s]+$/, "");
  }
  return cleaned;
}

function letterheadFor({ project, organizationName }: BuildInput): string {
  const date = new Date().toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${organizationName || "Productora"} · ${project.name} · ${date}`;
}

// Contenido de las 5 plantillas legales — antes vivía repetido dentro de
// cada ruta de la web (app/api/pdf/legal/[projectId]/**). Se extrajo
// aquí para que la app móvil pueda generar el mismo PDF, con el mismo
// texto, sin duplicarlo (ver app/api/mobile/projects/[projectId]/documentos-legales/[template]/route.tsx).
// El texto de cada documento está pensado para leerse como un
// documento legal de verdad — los datos van incrustados en la propia
// prosa, no en una lista de campos aparte.
export const LEGAL_TEMPLATES: Record<
  LegalTemplateSlug,
  { title: string; buildContent: (input: BuildInput) => LegalTemplateContent }
> = {
  "permiso-rodaje": {
    title: "Permiso de rodaje",
    buildContent(input) {
      const { project, organizationName } = input;
      const fields = cleanFields(input.fields);
      const { localizacion, direccion, fechas, horario, nombreAutoriza, dniAutoriza, condiciones } = fields;

      const paragraphs = [
        `Yo, ${nombreAutoriza || "—"}${dniAutoriza ? `, con documento de identidad número ${dniAutoriza}` : ""}, en mi condición de responsable autorizado de la localización «${localizacion || "—"}»${direccion ? `, situada en ${direccion}` : ""}, autorizo de manera libre y voluntaria a ${organizationName || "la productora"} y a su personal técnico y artístico a acceder a dicho espacio con los equipos de filmación, escenarios temporales y demás recursos necesarios para la grabación audiovisual del proyecto «${project.name}»${fechas ? `, durante las fechas ${fechas}` : ""}${horario ? `, en el horario de ${horario}` : ""}.`,
        `Asimismo, autorizo el uso de las imágenes y grabaciones de audio y vídeo captadas en la localización, dentro o alrededor de la misma, con los exclusivos efectos de su integración en la producción audiovisual del proyecto «${project.name}» y su posterior explotación, publicación y promoción por cualquier medio, conocido o por conocer.`,
        ...(condiciones
          ? [`Se establecen además las siguientes condiciones especiales para el acceso y uso de la localización: ${condiciones}.`]
          : []),
        `El equipo de producción se compromete a respetar en todo momento las condiciones aquí establecidas y a dejar el espacio en las mismas condiciones en que se encontraba antes del rodaje. He leído el presente documento antes de firmarlo y garantizo que comprendo su contenido.`,
      ];

      return {
        letterhead: letterheadFor(input),
        title: "Permiso de rodaje",
        paragraphs,
        signatures: [
          {
            role: "Autoriza el acceso a la localización",
            name: nombreAutoriza,
            meta: dniAutoriza ? `DNI: ${dniAutoriza}` : undefined,
          },
          { role: "Por la productora", name: organizationName },
        ],
        disclaimer: DISCLAIMER,
      };
    },
  },

  "cesion-imagen": {
    title: "Cesión de derechos de imagen",
    buildContent(input) {
      const { project, organizationName } = input;
      const fields = cleanFields(input.fields);
      const { nombre, dni, alcance, duracion } = fields;

      const paragraphs = [
        `Yo, ${nombre || "—"}${dni ? `, con documento de identidad número ${dni}` : ""}, autorizo de manera libre y voluntaria a ${organizationName || "la productora"} a captar, fijar, reproducir y difundir mi imagen dentro de la producción audiovisual del proyecto «${project.name}».`,
        `Esta cesión se realiza para su uso${alcance ? ` en ${alcance}` : ""}, con una duración${duracion ? ` de ${duracion}` : " indefinida, salvo revocación expresa por escrito"}, sin que suponga contraprestación económica adicional salvo pacto expreso entre las partes.`,
        `Esta autorización puede revocarse en cualquier momento mediante comunicación por escrito, sin efecto retroactivo sobre el material ya utilizado conforme a los términos aquí descritos. He leído el presente documento antes de firmarlo y garantizo que comprendo su contenido.`,
      ];

      return {
        letterhead: letterheadFor(input),
        title: "Cesión de derechos de imagen",
        paragraphs,
        signatures: [
          { role: "Cede su imagen", name: nombre, meta: dni ? `DNI: ${dni}` : undefined },
          { role: "Por la productora", name: organizationName },
        ],
        disclaimer: DISCLAIMER,
      };
    },
  },

  "contrato-colaboracion": {
    title: "Contrato de colaboración",
    buildContent(input) {
      const { project, organizationName } = input;
      const fields = cleanFields(input.fields);
      const { nombre, dni, rol, fechas, remuneracion, condiciones } = fields;

      const paragraphs = [
        `Entre ${organizationName || "la productora"}, productora del proyecto «${project.name}», y ${nombre || "—"}${dni ? `, con documento de identidad número ${dni}` : ""}, se acuerda la colaboración de esta última persona en el proyecto${rol ? ` en calidad de ${rol}` : ""}${fechas ? `, durante las fechas ${fechas}` : ""}.`,
        `Como contraprestación por esta colaboración, se acuerda${remuneracion ? ` lo siguiente: ${remuneracion}` : " una colaboración sin contraprestación económica, salvo pacto distinto entre las partes"}.`,
        ...(condiciones ? [`Se establecen además las siguientes condiciones adicionales: ${condiciones}.`] : []),
        `Ambas partes se comprometen a cumplir con los horarios y condiciones de trabajo acordados y a tratar con la debida confidencialidad cualquier material no publicado del proyecto al que tengan acceso durante la colaboración. Leído el presente documento, ambas partes lo firman en señal de conformidad.`,
      ];

      return {
        letterhead: letterheadFor(input),
        title: "Contrato de colaboración",
        paragraphs,
        signatures: [
          {
            role: "Persona colaboradora",
            name: nombre,
            meta: [dni ? `DNI: ${dni}` : null, rol].filter(Boolean).join(" · ") || undefined,
          },
          { role: "Por la productora", name: organizationName },
        ],
        disclaimer: DISCLAIMER,
      };
    },
  },

  "autorizacion-menor": {
    title: "Autorización de menor en pantalla",
    buildContent(input) {
      const { project, organizationName } = input;
      const fields = cleanFields(input.fields);
      const { nombreMenor, nombreTutor, dniTutor, relacion, condiciones } = fields;

      const paragraphs = [
        `Yo, ${nombreTutor || "—"}${dniTutor ? `, con documento de identidad número ${dniTutor}` : ""}, en mi condición de${relacion ? ` ${relacion}` : " tutor o tutora legal"} de ${nombreMenor || "—"}, autorizo de manera libre y voluntaria su participación en el rodaje del proyecto «${project.name}» de ${organizationName || "la productora"}, incluida su aparición en pantalla en el material audiovisual resultante.`,
        ...(condiciones ? [`Se establecen además las siguientes condiciones específicas para esta autorización: ${condiciones}.`] : []),
        `Esta autorización puede revocarse por escrito en cualquier momento antes del uso del material, y queda en todo caso sujeta a la normativa de protección de menores vigente en la jurisdicción correspondiente. He leído el presente documento antes de firmarlo y garantizo que comprendo su contenido.`,
      ];

      return {
        letterhead: letterheadFor(input),
        caution: "Documento con datos sensibles de una persona menor de edad",
        title: "Autorización de menor en pantalla",
        paragraphs,
        signatures: [
          {
            role: "Tutor o tutora legal",
            name: nombreTutor,
            meta: [dniTutor ? `DNI: ${dniTutor}` : null, relacion].filter(Boolean).join(" · ") || undefined,
          },
          { role: "Por la productora", name: organizationName },
        ],
        disclaimer: DISCLAIMER,
      };
    },
  },

  nda: {
    title: "Acuerdo de confidencialidad",
    buildContent(input) {
      const { project, organizationName } = input;
      const fields = cleanFields(input.fields);
      const { nombre, dni, duracion } = fields;

      const paragraphs = [
        `Yo, ${nombre || "—"}${dni ? `, con documento de identidad número ${dni}` : ""}, me comprometo a mantener la confidencialidad de todo el guion, material de producción e información no publicada del proyecto «${project.name}» de ${organizationName || "la productora"} a la que tenga acceso, y a no divulgarla a terceros sin autorización previa y expresa por escrito.`,
        `Esta obligación de confidencialidad se mantiene vigente${duracion ? ` durante ${duracion}` : " durante todo el tiempo que dure mi relación con el proyecto y con posterioridad a su finalización"}.`,
        `He leído el presente documento antes de firmarlo y garantizo que comprendo y acepto el compromiso de confidencialidad aquí descrito.`,
      ];

      return {
        letterhead: letterheadFor(input),
        title: "Acuerdo de confidencialidad",
        paragraphs,
        signatures: [
          { role: "Persona firmante", name: nombre, meta: dni ? `DNI: ${dni}` : undefined },
          { role: "Por la productora", name: organizationName },
        ],
        disclaimer: DISCLAIMER,
      };
    },
  },
};
