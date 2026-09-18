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
      <p className="font-display text-sm font-bold">{title}</p>
      {description && (
        <p className="mt-2 font-sans text-sm text-muted">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="btn btn-secondary mt-5 inline-block"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
