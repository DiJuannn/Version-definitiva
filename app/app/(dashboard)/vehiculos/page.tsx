import { getCurrentProfile } from "@/lib/current-user";
import { PageHeader } from "@/components/PageHeader";
import { VehiclesFleet } from "@/components/VehiclesFleet";

export default async function VehiculosPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  return (
    <div>
      <PageHeader
        backHref="/app"
        backLabel="← Inicio"
        eyebrow="Recursos"
        title="Vehículos"
        description="Flota de la organización: se reserva por día de rodaje desde cualquier proyecto, sin recrearla."
      />
      <VehiclesFleet organizationId={profile.organizationId} />
    </div>
  );
}
