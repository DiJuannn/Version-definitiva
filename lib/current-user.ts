import { cache } from "react";
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

  return prisma.user.findUnique({
    where: { id: user.id },
    include: { organization: true },
  });
});
