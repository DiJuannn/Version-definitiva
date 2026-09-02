import { cache } from "react";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

// cache() deduplica esta llamada dentro de una misma petición: el layout
// del dashboard y la página que se está viendo la llaman por separado
// (directamente o vía getProjectForCurrentUser), y sin esto cada una
// repetía su propia comprobación de sesión contra Supabase Auth — una
// llamada de red completa, no solo leer una cookie — más su propia
// consulta a la base de datos.
export const getCurrentProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Solo el id — nunca el email, para no mandar PII a un servicio externo.
  Sentry.setUser({ id: user.id });

  return getProfileByUserId(user.id);
});

export type Profile = NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>;

// Compartido con la autenticación de la app móvil (lib/mobile-auth.ts):
// una vez se sabe qué usuario de Supabase Auth hizo la petición (por
// cookie en la web, por token en la app), el resto es la misma consulta.
export function getProfileByUserId(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });
}
