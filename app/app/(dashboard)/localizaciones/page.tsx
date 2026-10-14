import { getCurrentProfile } from "@/lib/current-user";
import { PageHeader } from "@/components/PageHeader";
import { LocationsLibrary } from "@/components/LocationsLibrary";

export default async function LocalizacionesPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Recursos"
        title="Localizaciones"
        description="Los sitios donde rodáis, con su contacto, permisos y fotos. Se guardan una vez y se eligen desde el Guion de cualquier proyecto."
      />
      <LocationsLibrary organizationId={profile.organizationId} />
    </div>
  );
}
