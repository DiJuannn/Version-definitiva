import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { courierPrime } from "@/lib/screenplay/font";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { getScreenplay, SCREENPLAY_FORMAT_LABELS } from "@/lib/screenplay-core";
import { ScreenplayEditorLoader } from "@/components/screenplay/ScreenplayEditorLoader";


export const metadata: Metadata = { title: "Guion" };

export default async function GuionEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ screenplayId: string }>;
  searchParams: Promise<{ paso?: string }>;
}) {
  const [{ screenplayId }, { paso }] = await Promise.all([params, searchParams]);
  const profile = await getCurrentProfile();
  if (!profile) notFound();

  const screenplay = await getScreenplay(profile.organizationId, screenplayId);
  if (!screenplay) notFound();

  const projects = await prisma.project.findMany({
    where: { organizationId: profile.organizationId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
  });
  const linked = projects.find((p) => p.id === screenplay.projectId) ?? null;

  const initialState = screenplay.ydoc ? Buffer.from(screenplay.ydoc).toString("base64") : "";
  const userName = profile.fullName?.trim() || profile.email.split("@")[0];
  const formatLabel = SCREENPLAY_FORMAT_LABELS[screenplay.format];

  return (
    <div className={courierPrime.variable}>
      <ScreenplayEditorLoader
        screenplayId={screenplay.id}
        initialState={initialState}
        userId={profile.id}
        userName={userName}
        title={screenplay.title}
        subtitle={screenplay.author ? `${formatLabel} · ${screenplay.author}` : formatLabel}
        initialStep={paso ?? null}
        linkedProject={linked}
        settings={{
          id: screenplay.id,
          title: screenplay.title,
          format: screenplay.format,
          author: screenplay.author,
          projectId: screenplay.projectId,
          projects,
        }}
      />
    </div>
  );
}
