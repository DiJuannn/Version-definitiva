import { getCurrentProfile } from "@/lib/current-user";
import { PageHeader } from "@/components/PageHeader";
import { LocationsLibrary } from "@/components/LocationsLibrary";

export default async function LocalizacionesPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  return (
    <div>
      <PageHeader
        backHref="/app"
        backLabel="← Inicio"
        eyebrow="Recursos"
        title="Localizaciones"
        description="Biblioteca de la organización: se eligen desde el Guion de cualquier proyecto, sin recrearlas."
      />
      <LocationsLibrary organizationId={profile.organizationId} />
    </div>
  );
}
