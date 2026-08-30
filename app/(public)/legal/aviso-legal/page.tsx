import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { LegalHeading, LegalPage, PendingNotice } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Aviso legal" };

export default async function AvisoLegalPage() {
  const site = await prisma.siteContent.findFirst({
    where: { organization: { isPlatformOwner: true } },
  });
  const legalName = site?.legalName;
  const legalTaxId = site?.legalTaxId;
  const legalAddress = site?.legalAddress;
  const contactEmail = site?.contactEmail ?? "hola@versiondefinitiva.com";
  const missing = !legalName || !legalTaxId || !legalAddress;

  return (
    <LegalPage title="Aviso legal" updatedAt="30 de agosto de 2026">
      {missing && (
        <PendingNotice what="nombre legal, NIF/CIF y domicilio del titular" />
      )}

      <p>
        En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de
        Servicios de la Sociedad de la Información y de Comercio Electrónico
        (LSSI-CE), se informa de los siguientes datos: este sitio web (en
        adelante, el &quot;Sitio&quot;) es titularidad de:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong className="text-fg">Titular:</strong>{" "}
          {legalName || "[pendiente de completar]"}
        </li>
        <li>
          <strong className="text-fg">NIF/CIF:</strong>{" "}
          {legalTaxId || "[pendiente de completar]"}
        </li>
        <li>
          <strong className="text-fg">Domicilio:</strong>{" "}
          {legalAddress || "[pendiente de completar]"}
        </li>
        <li>
          <strong className="text-fg">Contacto:</strong> {contactEmail}
        </li>
        <li>
          <strong className="text-fg">Actividad:</strong> producción
          audiovisual y prestación del servicio de gestión de producciones
          &quot;Taller&quot; en modalidad de software como servicio (SaaS).
        </li>
      </ul>

      <LegalHeading>Objeto</LegalHeading>
      <p>
        El presente aviso legal regula el acceso y uso del Sitio, así como del
        servicio Taller accesible a través de él. El acceso al Sitio y el uso
        del servicio Taller atribuyen la condición de usuario y suponen la
        aceptación de las condiciones aquí recogidas, así como de la{" "}
        <a href="/legal/privacidad" className="text-fg underline hover:text-accent">
          Política de privacidad
        </a>
        , la{" "}
        <a href="/legal/cookies" className="text-fg underline hover:text-accent">
          Política de cookies
        </a>{" "}
        y, para los usuarios registrados en Taller, los{" "}
        <a href="/legal/terminos" className="text-fg underline hover:text-accent">
          Términos de uso
        </a>
        .
      </p>

      <LegalHeading>Propiedad intelectual</LegalHeading>
      <p>
        Los contenidos del Sitio (textos, diseño, logotipos, imágenes e
        ilustraciones, incluida la mascota &quot;ajolote&quot;) son propiedad
        del titular o de terceros que han autorizado su uso, y están
        protegidos por la normativa de propiedad intelectual e industrial.
        Queda prohibida su reproducción, distribución o transformación sin
        autorización expresa, salvo en los casos permitidos por la ley.
      </p>

      <LegalHeading>Responsabilidad</LegalHeading>
      <p>
        El titular no garantiza la disponibilidad continua del Sitio ni del
        servicio Taller, ni se responsabiliza de los daños derivados de
        interrupciones, virus u otros elementos ajenos a su control razonable.
        El Sitio puede contener enlaces a sitios de terceros (por ejemplo,
        vídeos incrustados de YouTube o Vimeo en el portfolio) sobre cuyo
        contenido el titular no ejerce ningún control.
      </p>

      <LegalHeading>Legislación aplicable</LegalHeading>
      <p>
        Las presentes condiciones se rigen por la legislación española. Para
        cualquier controversia derivada del acceso o uso del Sitio, las
        partes se someten a los juzgados y tribunales que correspondan según
        la normativa de protección de consumidores aplicable.
      </p>
    </LegalPage>
  );
}
