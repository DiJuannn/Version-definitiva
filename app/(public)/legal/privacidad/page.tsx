import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { LegalHeading, LegalPage, PendingNotice } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Política de privacidad" };

export default async function PrivacidadPage() {
  const site = await prisma.siteContent.findFirst();
  const legalName = site?.legalName;
  const legalTaxId = site?.legalTaxId;
  const legalAddress = site?.legalAddress;
  const contactEmail = site?.contactEmail ?? "hola@versiondefinitiva.com";
  const missing = !legalName || !legalTaxId || !legalAddress;

  return (
    <LegalPage title="Política de privacidad" updatedAt="30 de agosto de 2026">
      {missing && (
        <PendingNotice what="nombre legal, NIF/CIF y domicilio del responsable del tratamiento" />
      )}

      <p>
        Esta política describe cómo se tratan los datos personales de quienes
        visitan este Sitio o se registran en el servicio Taller, de acuerdo
        con el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 de
        Protección de Datos y garantía de los derechos digitales (LOPDGDD).
      </p>

      <LegalHeading>Responsable del tratamiento</LegalHeading>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong className="text-fg">Identidad:</strong>{" "}
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
          <strong className="text-fg">Email de contacto:</strong>{" "}
          {contactEmail}
        </li>
      </ul>

      <LegalHeading>Qué datos tratamos</LegalHeading>
      <p>Según cómo interactúes con nosotros:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Si nos escribes por email de contacto: tu dirección de correo y el
          contenido del mensaje.
        </li>
        <li>
          Si te registras en <strong className="text-fg">Taller</strong>:
          nombre de tu productora, tu nombre, email y contraseña (esta última
          almacenada de forma cifrada por nuestro proveedor de
          autenticación, nunca en texto plano), y todos los datos de
          producción que introduzcas voluntariamente en la herramienta
          (escenas, personajes, localizaciones, presupuestos, guiones, etc.).
        </li>
      </ul>

      <LegalHeading>Finalidad y legitimación</LegalHeading>
      <p>
        Tratamos tus datos para: (a) gestionar tu cuenta y prestarte el
        servicio Taller, con base en la ejecución del contrato de uso que
        aceptas al registrarte; (b) responder a tus consultas de contacto,
        con base en tu consentimiento al escribirnos; y (c) cumplir
        obligaciones legales cuando corresponda.
      </p>

      <LegalHeading>Encargados de tratamiento y terceros</LegalHeading>
      <p>
        Para prestar el servicio utilizamos los siguientes proveedores, que
        actúan como encargados de tratamiento bajo sus propias garantías de
        seguridad y cumplimiento del RGPD:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong className="text-fg">Supabase</strong> (base de datos,
          autenticación y almacenamiento de archivos) — datos alojados en la
          Unión Europea (región Irlanda).
        </li>
        <li>
          <strong className="text-fg">Vercel</strong> (alojamiento del Sitio y
          de la aplicación) — infraestructura con presencia global; Vercel se
          adhiere al marco de transferencia de datos UE-EEUU (Data Privacy
          Framework) cuando el procesamiento ocurre fuera de la UE.
        </li>
        <li>
          <strong className="text-fg">Mistral AI</strong> (análisis
          automático de guiones mediante inteligencia artificial, solo si
          decides usar esa función dentro de Taller) — empresa con sede en la
          Unión Europea.
        </li>
      </ul>
      <p>No vendemos ni cedemos tus datos a terceros con fines comerciales.</p>

      <LegalHeading>Plazo de conservación</LegalHeading>
      <p>
        Conservamos los datos de tu cuenta mientras esté activa. Si solicitas
        la baja o eliminación de tu cuenta, los datos se eliminan o
        anonimizan en un plazo razonable, salvo obligación legal de
        conservación superior.
      </p>

      <LegalHeading>Tus derechos</LegalHeading>
      <p>
        Puedes ejercer tus derechos de acceso, rectificación, supresión,
        oposición, limitación del tratamiento y portabilidad escribiendo a{" "}
        <a
          href={`mailto:${contactEmail}`}
          className="text-fg underline hover:text-accent"
        >
          {contactEmail}
        </a>
        . También tienes derecho a presentar una reclamación ante la Agencia
        Española de Protección de Datos (
        <a
          href="https://www.aepd.es"
          target="_blank"
          rel="noreferrer"
          className="text-fg underline hover:text-accent"
        >
          www.aepd.es
        </a>
        ) si consideras que el tratamiento no se ajusta a la normativa.
      </p>
    </LegalPage>
  );
}
