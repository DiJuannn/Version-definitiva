import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { getProjectOwnerLabel } from "@/lib/project-access";
import { acceptProjectShare } from "@/lib/actions/project-shares";
import { SubmitButton } from "@/components/SubmitButton";

export default async function AcceptProjectSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`/app/login?next=${encodeURIComponent(`/app/proyectos/compartido/${token}`)}`);
  }

  const share = await prisma.projectShare.findUnique({
    where: { token },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          organizationId: true,
          createdById: true,
        },
      },
    },
  });

  if (!share) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold uppercase">
          Enlace no válido
        </h1>
        <p className="mt-2 font-mono text-sm text-muted">
          Este enlace de proyecto compartido no existe o ha sido revocado.
        </p>
      </div>
    );
  }

  // Ya es tuyo (misma organización) o ya lo aceptaste tú antes — directo.
  if (share.project.organizationId === profile.organizationId || share.userId === profile.id) {
    redirect(`/app/${share.projectId}`);
  }

  if (share.userId && share.userId !== profile.id) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold uppercase">
          Enlace ya usado
        </h1>
        <p className="mt-2 font-mono text-sm text-muted">
          Este enlace de proyecto compartido ya lo ha reclamado otra persona.
          Pide uno nuevo a quien te lo compartió.
        </p>
      </div>
    );
  }

  const ownerLabel = await getProjectOwnerLabel(share.project);

  return (
    <div>
      <p className="font-mono text-xs tracking-widest text-accent uppercase">
        Proyecto compartido
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold uppercase">
        {share.project.name}
      </h1>
      <p className="mt-3 max-w-md font-mono text-sm text-muted">
        <strong className="text-fg">{ownerLabel}</strong> te ha compartido
        este proyecto. Podrás verlo y editarlo, pero no verás el resto de
        sus proyectos ni de su organización.
      </p>
      <form action={acceptProjectShare.bind(null, token)} className="mt-6">
        <SubmitButton
          pendingLabel="Entrando…"
          className="rounded-full bg-accent px-6 py-2.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
        >
          Entrar al proyecto
        </SubmitButton>
      </form>
    </div>
  );
}
