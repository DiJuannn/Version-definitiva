import { getCurrentProfile } from "@/lib/current-user";
import { PageHeader } from "@/components/PageHeader";
import { NewVehicleButton, VehiclesFleet } from "@/components/VehiclesFleet";

export default async function VehiculosPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Recursos"
        title="Vehículos"
        description="La flota de la productora: qué es cada vehículo, su matrícula y qué días está reservado. Se reserva desde el Plan de rodaje."
        actions={<NewVehicleButton />}
      />
      <VehiclesFleet organizationId={profile.organizationId} hideCreate />
    </div>
  );
}
