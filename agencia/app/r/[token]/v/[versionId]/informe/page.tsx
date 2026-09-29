import { redirect } from "next/navigation";
import { orNotFound } from "@/lib/http/page";
import { getReviewPayload } from "@/lib/services/review";
import { resolveGuest } from "@/lib/services/guest-view";
import { ReviewReport } from "@/components/review/report";

export default async function GuestReport(props: PageProps<"/r/[token]/v/[versionId]/informe">) {
  const { token, versionId } = await props.params;
  const r = await resolveGuest(token);
  if (r.state !== "ok") redirect(`/r/${token}`);
  return <ReviewReport p={await orNotFound(getReviewPayload(r.guest, versionId))} />;
}
