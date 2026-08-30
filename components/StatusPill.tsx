import { ProjectStatus } from "@/lib/generated/prisma";
import { PROJECT_STATUS_INTENSITY, PROJECT_STATUS_LABELS } from "@/lib/labels";

export function StatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted uppercase">
      <span
        className="h-1.5 w-1.5 rounded-full bg-accent"
        style={{ opacity: PROJECT_STATUS_INTENSITY[status] }}
      />
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}
