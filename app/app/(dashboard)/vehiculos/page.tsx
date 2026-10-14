import { getCurrentProfile } from "@/lib/current-user";
import { PageHeader } from "@/components/PageHeader";
import { VehiclesFleet } from "@/components/VehiclesFleet";

export default async function VehiculosPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Recursos"
        title="Vehículos"
        description="La flota de la productora. Se apunta una vez y se reserva para cada día de rodaje desde el Plan de rodaje de cualquier proyecto."
      />
      <VehiclesFleet organizationId={profile.organizationId} />
    </div>
  );
}
