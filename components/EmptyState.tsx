import Link from "next/link";
import { EmptyPreview, type EmptyPreviewKind } from "@/components/EmptyPreview";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  preview,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  // Muestra apagada de cómo se verá la herramienta con contenido.
  preview?: EmptyPreviewKind;
}) {
  return (
    // Sin caja: un vacío es una invitación a empezar, no otro recuadro.
    <div className="mt-10 py-10 text-center">
      <p className="poster-sub text-[28px]">{title}</p>
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
      {preview && <EmptyPreview kind={preview} />}
    </div>
  );
}
