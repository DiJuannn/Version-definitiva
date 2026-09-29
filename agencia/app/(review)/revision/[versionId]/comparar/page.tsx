import type { Metadata } from "next";
import { orNotFound } from "@/lib/http/page";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { getReviewPayload } from "@/lib/services/review";
import { CompareRoom } from "@/components/review/compare-room";

export const metadata: Metadata = { title: "Comparar versiones" };

export default async function ComparePage(props: PageProps<"/revision/[versionId]/comparar">) {
  const me = await requireUser();
  const { versionId } = await props.params;
  const sp = await props.searchParams;
  const other = typeof sp.con === "string" ? sp.con : null;
  if (!other) notFound();
  const [left, right] = await orNotFound(Promise.all([getReviewPayload(me, versionId), getReviewPayload(me, other)]));
  if (left.piece.id !== right.piece.id) notFound();
  return <CompareRoom key={`${versionId}-${other}`} left={{ p: left }} right={{ p: right }} versionHrefBase="/revision/" backHref={`/revision/${versionId}`} />;
}
