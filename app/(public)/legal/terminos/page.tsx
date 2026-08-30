import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { LegalHeading, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Términos de uso" };

export default async function TerminosPage() {
  const site = await prisma.siteContent.findFirst();
  const contactEmail = site?.contactEmail ?? "hola@versiondefinitiva.com";

  return (
    <LegalPage title="Términos de uso de Taller" updatedAt="30 de agosto de 2026">
      <p>
        Estas condiciones regulan el uso de <strong className="text-fg">Taller</strong>,
        la herramienta de gestión de producciones audiovisuales accesible en{" "}
        <span className="text-fg">/app</span>. Al crear una cuenta, aceptas
        estas condiciones.
      </p>

      <LegalHeading>1. Cuenta y organización</LegalHeading>
      <p>
        Al registrarte creas una cuenta personal asociada a una organización
        (tu productora). Eres responsable de mantener la confidencialidad de
        tu contraseña y de toda la actividad que ocurra bajo tu cuenta. Si
        invitas a otras personas a tu organización, tú decides qué nivel de
        acceso (Admin o Miembro) les corresponde.
      </p>

      <LegalHeading>2. Contenido que subes</LegalHeading>
      <p>
        Todo el contenido que introduces en Taller (guiones, escenas,
        presupuestos, documentos, fotos de localizaciones, etc.) es tuyo. No
        reclamamos ninguna propiedad sobre él. Eres el único responsable de
        tener los derechos necesarios sobre lo que subas y de que su
        contenido sea lícito.
      </p>

      <LegalHeading>3. Uso permitido</LegalHeading>
      <p>
        Te comprometes a usar Taller de forma lícita, sin subir contenido
        ilegal, sin intentar acceder a datos de otras organizaciones ni
        interferir con el funcionamiento del servicio.
      </p>

      <LegalHeading>4. Disponibilidad y copias de seguridad</LegalHeading>
      <p>
        Hacemos lo razonablemente posible por mantener el servicio
        disponible, pero no lo garantizamos al 100% en todo momento (puede
        haber mantenimientos o incidencias de nuestros proveedores de
        infraestructura). Te recomendamos exportar periódicamente tus datos
        importantes (por ejemplo, descargando los PDFs del dossier, plan de
        rodaje o presupuesto) como copia de seguridad propia.
      </p>

      <LegalHeading>5. Suspensión</LegalHeading>
      <p>
        Podemos suspender o cancelar una cuenta que incumpla gravemente estas
        condiciones o la ley aplicable, avisando previamente salvo que la
        urgencia lo impida.
      </p>

      <LegalHeading>6. Cambios</LegalHeading>
      <p>
        Podemos actualizar estas condiciones a medida que evolucione el
        servicio. Si el cambio es relevante, te lo notificaremos por email o
        dentro de la propia aplicación.
      </p>

      <LegalHeading>7. Contacto</LegalHeading>
      <p>
        Para cualquier duda sobre estas condiciones, escríbenos a{" "}
        <a
          href={`mailto:${contactEmail}`}
          className="text-fg underline hover:text-accent"
        >
          {contactEmail}
        </a>
        .
      </p>
    </LegalPage>
  );
}
