import { getCurrentProfile } from "@/lib/current-user";
import { PageHeader } from "@/components/PageHeader";
import { LocationsLibrary, NewLocationButton } from "@/components/LocationsLibrary";

export default async function LocalizacionesPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Recursos"
        title="Localizaciones"
        description="Dónde rodáis, en el mapa, con su contacto y lo que tiene cada sitio. Se guardan una vez y se eligen desde el Guion de cualquier proyecto."
        actions={<NewLocationButton />}
      />
      <LocationsLibrary organizationId={profile.organizationId} hideCreate />
    </div>
  );
}
