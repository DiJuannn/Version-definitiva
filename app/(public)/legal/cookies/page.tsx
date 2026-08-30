import type { Metadata } from "next";
import { LegalHeading, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Política de cookies" };

export default function CookiesPage() {
  return (
    <LegalPage title="Política de cookies" updatedAt="30 de agosto de 2026">
      <p>
        Una cookie es un pequeño archivo que un sitio web guarda en tu
        navegador. Esta página explica qué usamos nosotros y por qué.
      </p>

      <LegalHeading>Lo importante primero</LegalHeading>
      <p>
        <strong className="text-fg">
          No utilizamos cookies de analítica, publicidad ni seguimiento.
        </strong>{" "}
        Solo usamos las estrictamente necesarias para que la web y el
        servicio Taller funcionen, que están exentas de necesitar tu
        consentimiento (art. 22.2 LSSI-CE).
      </p>

      <LegalHeading>Cookies que usamos</LegalHeading>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong className="text-fg">Sesión de autenticación</strong>{" "}
          (proveedor: Supabase) — mantienen tu sesión iniciada dentro de
          Taller. Sin ellas no podrías entrar a tu cuenta. Se borran al
          cerrar sesión o caducan automáticamente.
        </li>
      </ul>

      <LegalHeading>Almacenamiento local (no es cookie, pero es similar)</LegalHeading>
      <p>
        Usamos <code className="text-fg">sessionStorage</code> del navegador
        para recordar, dentro de la misma pestaña, que ya viste la animación
        de bienvenida — así no se repite cada vez que navegas por la web. Se
        borra automáticamente al cerrar la pestaña y no identifica a nadie.
      </p>

      <LegalHeading>Cómo desactivar las cookies</LegalHeading>
      <p>
        Puedes bloquear o eliminar las cookies desde la configuración de tu
        navegador. Ten en cuenta que, al ser todas técnicas, bloquearlas
        impedirá iniciar sesión en Taller.
      </p>

      <LegalHeading>Si esto cambia</LegalHeading>
      <p>
        Si en el futuro incorporamos cookies de analítica o publicidad,
        actualizaremos esta política y te pediremos tu consentimiento
        explícito antes de activarlas.
      </p>
    </LegalPage>
  );
}
