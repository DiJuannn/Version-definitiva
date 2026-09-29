import { notFound, redirect } from "next/navigation";
import { orNotFound } from "@/lib/http/page";
import { getReviewPayload } from "@/lib/services/review";
import { resolveGuest } from "@/lib/services/guest-view";
import { CompareRoom } from "@/components/review/compare-room";

export default async function GuestCompare(props: PageProps<"/r/[token]/v/[versionId]/comparar">) {
  const { token, versionId } = await props.params;
  const sp = await props.searchParams;
  const r = await resolveGuest(token);
  if (r.state !== "ok") redirect(`/r/${token}`);
  const other = typeof sp.con === "string" ? sp.con : null;
  if (!other) notFound();
  const [left, right] = await orNotFound(Promise.all([getReviewPayload(r.guest, versionId), getReviewPayload(r.guest, other)]));
  if (left.piece.id !== right.piece.id) notFound();
  return <CompareRoom key={`${versionId}-${other}`} left={{ p: left }} right={{ p: right }} versionHrefBase={`/r/${token}/v/`} backHref={`/r/${token}/v/${versionId}`} />;
}
