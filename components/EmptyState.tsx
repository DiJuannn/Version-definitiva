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
    // Sin caja: un vacío es una invitación a empezar, no otro recuadro.
    <div className="mt-10 py-10 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {description && (
        <p className="mx-auto mt-2 max-w-md font-sans text-sm text-muted">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="btn btn-primary mt-5"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
