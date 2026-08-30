import { prisma } from "@/lib/prisma";
import { SignupForm } from "@/components/SignupForm";
import { AcceptInviteForm } from "@/components/AcceptInviteForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite: token } = await searchParams;

  if (!token) {
    return <SignupForm />;
  }

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { organization: true },
  });

  if (!invite || invite.status !== "PENDING") {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold uppercase">
          Invitación no válida
        </h1>
        <p className="mt-2 font-mono text-xs text-muted">
          Este enlace de invitación ya no funciona — puede que ya se haya
          usado o que te lo hayan revocado. Pide uno nuevo a quien te invitó.
        </p>
      </div>
    );
  }

  return (
    <AcceptInviteForm
      token={invite.token}
      email={invite.email}
      organizationName={invite.organization.name}
    />
  );
}
