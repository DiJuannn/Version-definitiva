import Link from "next/link";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="mt-10 border border-dashed border-line p-8 text-center">
      <p className="font-display text-sm font-bold uppercase">{title}</p>
      {description && (
        <p className="mt-2 font-mono text-sm text-muted">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-5 inline-block rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
