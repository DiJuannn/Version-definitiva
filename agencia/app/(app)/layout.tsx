import { logoutAction } from "@/app/actions/auth";
import { Sidebar } from "@/components/shell/sidebar";
import { navFor } from "@/components/shell/nav";
import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/domain/labels";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [org, unread] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { clientRequests: true } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return (
    <div className="md:flex">
      <Sidebar
        groups={navFor(user, { clientRequests: org.clientRequests })}
        user={{ name: user.name, roleLabel: ROLE_LABEL[user.role] }}
        unread={unread}
        logout={logoutAction}
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
