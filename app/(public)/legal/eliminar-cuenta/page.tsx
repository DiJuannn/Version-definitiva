import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { LegalHeading, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Eliminar tu cuenta y tus datos" };

// URL pública de "cómo pedir el borrado de la cuenta y de los datos": Google
// Play la exige en la ficha de las apps que permiten crear cuenta. Debe
// funcionar sin haber iniciado sesión, así que describe todas las vías.
export default async function EliminarCuentaPage() {
  const site = await prisma.siteContent.findFirst({
    where: { organization: { isPlatformOwner: true } },
  });
  const contactEmail = site?.contactEmail ?? "hola@versiondefinitiva.com";

  return (
    <LegalPage title="Eliminar tu cuenta y tus datos" updatedAt="19 de septiembre de 2026">
      <p>
        Puedes borrar tu cuenta de <strong className="text-fg">Taller</strong>{" "}
        y los datos asociados en cualquier momento, sin esperar a nadie. Esta
        página explica cómo hacerlo desde la app, desde la web o por correo,
        y qué ocurre con tus datos.
      </p>

      <LegalHeading>Desde la app móvil de Taller</LegalHeading>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Abre la app e inicia sesión.</li>
        <li>
          Ve a la pestaña <strong className="text-fg">Perfil</strong>.
        </li>
        <li>
          Pulsa <strong className="text-fg">Eliminar mi cuenta</strong>.
        </li>
        <li>Escribe la frase de confirmación que te pide la app y confirma.</li>
      </ol>

      <LegalHeading>Desde la web</LegalHeading>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Inicia sesión en Taller desde el navegador.</li>
        <li>
          Entra en <strong className="text-fg">Organización</strong> y abre la
          pestaña <strong className="text-fg">Cuenta</strong>.
        </li>
        <li>
          Pulsa <strong className="text-fg">Eliminar mi cuenta</strong> y
          confirma escribiendo la frase que se te pide.
        </li>
      </ol>

      <LegalHeading>Si no puedes acceder a tu cuenta</LegalHeading>
      <p>
        Escríbenos a{" "}
        <a
          href={`mailto:${contactEmail}?subject=Eliminar%20mi%20cuenta%20de%20Taller`}
          className="text-fg underline hover:text-accent"
        >
          {contactEmail}
        </a>{" "}
        desde el correo con el que te registraste, indicando que quieres
        eliminar tu cuenta. Comprobaremos que la solicitud es tuya y la
        tramitaremos.
      </p>

      <LegalHeading>Qué se elimina</LegalHeading>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong className="text-fg">
            Si eres la única persona de tu organización:
          </strong>{" "}
          se borra todo: tu usuario, la organización y todos sus datos
          (proyectos, guiones, escenas, personajes, localizaciones,
          presupuestos, archivos, tareas, calendario, equipo y flota). La
          eliminación es inmediata y definitiva.
        </li>
        <li>
          <strong className="text-fg">
            Si tu organización tiene más personas:
          </strong>{" "}
          se borra tu usuario y tu acceso. Los proyectos y demás datos
          pertenecen a la organización y se conservan para el resto de sus
          miembros; tu nombre deja de aparecer como autor.
        </li>
      </ul>

      <LegalHeading>Qué puede conservarse</LegalHeading>
      <p>
        Los proveedores de pago (Lemon Squeezy en la web, Google Play en la
        app de Android) conservan por su cuenta los justificantes de las
        compras que hayas hecho, porque la ley les obliga a guardarlos. Los
        registros técnicos de errores no contienen el contenido de tus
        proyectos.
      </p>

      <LegalHeading>Importante si tienes un plan PRO</LegalHeading>
      <p>
        Eliminar la cuenta{" "}
        <strong className="text-fg">no cancela automáticamente</strong> una
        suscripción de pago. Cancélala antes de borrar la cuenta para que no
        se te siga cobrando:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Si la contrataste en la{" "}
          <strong className="text-fg">app de Android</strong>: en Google Play,
          Menú → Pagos y suscripciones → Suscripciones → Taller → Cancelar.
        </li>
        <li>
          Si la contrataste en la <strong className="text-fg">web</strong>:
          desde el enlace de gestión que aparece en el correo del recibo de
          Lemon Squeezy, o escribiéndonos a {contactEmail}.
        </li>
      </ul>

      <LegalHeading>Otros derechos sobre tus datos</LegalHeading>
      <p>
        Para acceder a tus datos, rectificarlos o pedir su portabilidad,
        consulta nuestra{" "}
        <a
          href="/legal/privacidad"
          className="text-fg underline hover:text-accent"
        >
          política de privacidad
        </a>
        .
      </p>
    </LegalPage>
  );
}
