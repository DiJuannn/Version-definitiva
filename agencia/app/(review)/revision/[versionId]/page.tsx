import type { Metadata } from "next";
import { orNotFound } from "@/lib/http/page";
import { requireUser } from "@/lib/auth/current";
import { getReviewPayload } from "@/lib/services/review";
import { ReviewRoom } from "@/components/review/review-room";

export const metadata: Metadata = { title: "Revisión" };

export default async function ReviewPage(props: PageProps<"/revision/[versionId]">) {
  const me = await requireUser();
  const { versionId } = await props.params;
  const sp = await props.searchParams;
  const payload = await orNotFound(getReviewPayload(me, versionId));
  return (
    <ReviewRoom
      key={versionId}
      initial={payload}
      versionHrefBase="/revision/"
      backHref={`/piezas/${payload.piece.id}`}
      backLabel="Volver a la pieza"
      initialCommentId={typeof sp.c === "string" ? sp.c : null}
      reportHref={`/revision/${versionId}/informe`}
    />
  );
}
