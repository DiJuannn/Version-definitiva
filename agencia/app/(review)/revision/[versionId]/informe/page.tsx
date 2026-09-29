import type { Metadata } from "next";
import { orNotFound } from "@/lib/http/page";
import { requireUser } from "@/lib/auth/current";
import { getReviewPayload } from "@/lib/services/review";
import { ReviewReport } from "@/components/review/report";

export const metadata: Metadata = { title: "Informe de revisión" };

export default async function ReportPage(props: PageProps<"/revision/[versionId]/informe">) {
  const me = await requireUser();
  const { versionId } = await props.params;
  return <ReviewReport p={await orNotFound(getReviewPayload(me, versionId))} />;
}
