import { fmtRelative } from "@/lib/format";

const ACTION_LABEL: Record<string, string> = {
  "project.create": "creó el proyecto",
  "project.request": "solicitó el proyecto",
  "project.update": "editó el proyecto",
  "project.status": "cambió el estado del proyecto",
  "piece.create": "añadió una pieza",
  "piece.update": "editó una pieza",
  "piece.assign": "asignó editor",
  "piece.reassign": "reasignó editor",
  "piece.status": "cambió el estado de una pieza",
  "brief.save": "guardó el brief",
  "brief.submit": "envió el brief",
  "version.create": "subió una versión",
  "version.publish": "publicó una versión al cliente",
  "version.internal_changes": "pidió cambios internos",
  "version.approve": "aprobó una versión",
  "version.request_changes": "pidió cambios",
  "approval.revoke": "revocó una aprobación",
  "comment.create": "comentó",
  "comment.reply": "respondió",
  "comment.edit": "editó un comentario",
  "comment.withdraw": "retiró un comentario",
  "correction.update": "actualizó una corrección",
  "blocker.add": "registró un bloqueo",
  "blocker.resolve": "resolvió un bloqueo",
  "delivery.create": "entregó el archivo final",
  "media.download": "descargó un archivo",
  "material.link": "añadió material",
  "share.create": "creó un enlace de revisión",
  "share.revoke": "revocó un enlace de revisión",
  "style.apply": "aplicó el perfil de estilo vigente",
  "finance.add": "añadió una línea económica",
};

export function actionLabel(action: string) {
  return ACTION_LABEL[action] ?? action;
}

export function ActivityList({ items }: { items: { id: string; actorLabel: string; action: string; createdAt: Date }[] }) {
  if (!items.length) return <p className="px-4 py-4 text-[13px] text-ink-3">Todavía no hay actividad.</p>;
  return (
    <ol className="flex flex-col gap-0.5 px-4 py-3">
      {items.map((i) => (
        <li key={i.id} className="flex items-baseline gap-2 py-1 text-[13px]">
          <span className="font-medium text-ink">{i.actorLabel}</span>
          <span className="text-ink-2">{actionLabel(i.action)}</span>
          <span className="ml-auto shrink-0 text-ink-3 tabular">{fmtRelative(i.createdAt)}</span>
        </li>
      ))}
    </ol>
  );
}
