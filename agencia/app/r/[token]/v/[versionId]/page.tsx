import { redirect } from "next/navigation";
import { orNotFound } from "@/lib/http/page";
import { db } from "@/lib/db";
import { getReviewPayload } from "@/lib/services/review";
import { resolveGuest } from "@/lib/services/guest-view";
import { ReviewRoom } from "@/components/review/review-room";

export default async function GuestReview(props: PageProps<"/r/[token]/v/[versionId]">) {
  const { token, versionId } = await props.params;
  const sp = await props.searchParams;
  const r = await resolveGuest(token);
  if (r.state !== "ok") redirect(`/r/${token}`);
  const payload = await orNotFound(getReviewPayload(r.guest, versionId));
  await db.shareLinkEvent.create({ data: { shareLinkId: r.guest.link.id, guestId: r.guest.id, type: "VIEWED", data: { versionId } } });
  return (
    <ReviewRoom
      key={versionId}
      initial={payload}
      versionHrefBase={`/r/${token}/v/`}
      backHref={`/r/${token}`}
      backLabel="Volver"
      initialCommentId={typeof sp.c === "string" ? sp.c : null}
      reportHref={`/r/${token}/v/${versionId}/informe`}
    />
  );
}
