import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Courier_Prime } from "next/font/google";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { getScreenplay, SCREENPLAY_FORMAT_LABELS } from "@/lib/screenplay-core";
import { ScreenplayEditorLoader } from "@/components/screenplay/ScreenplayEditorLoader";

// Courier Prime: la Courier de los guiones, pensada para pantalla. Mismo
// ancho de carácter que la Courier del PDF, así la página se ve igual.
const courierPrime = Courier_Prime({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-courier",
});

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
