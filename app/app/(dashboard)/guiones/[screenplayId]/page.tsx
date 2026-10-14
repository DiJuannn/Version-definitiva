import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Courier_Prime } from "next/font/google";
import { getCurrentProfile } from "@/lib/current-user";
import { getScreenplay, SCREENPLAY_FORMAT_LABELS } from "@/lib/screenplay-core";
import { ScreenplayHeader } from "@/components/screenplay/ScreenplayHeader";
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

export default async function GuionEditorPage({ params }: { params: Promise<{ screenplayId: string }> }) {
  const { screenplayId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) notFound();

  const screenplay = await getScreenplay(profile.organizationId, screenplayId);
  if (!screenplay) notFound();

  const initialState = screenplay.ydoc ? Buffer.from(screenplay.ydoc).toString("base64") : "";
  const userName = profile.fullName?.trim() || profile.email.split("@")[0];

  return (
    <div className={courierPrime.variable}>
      <ScreenplayEditorLoader
        screenplayId={screenplay.id}
        initialState={initialState}
        userId={profile.id}
        userName={userName}
        header={
          <ScreenplayHeader
            id={screenplay.id}
            title={screenplay.title}
            format={screenplay.format}
            formatLabel={SCREENPLAY_FORMAT_LABELS[screenplay.format]}
            logline={screenplay.logline}
            author={screenplay.author}
          />
        }
      />
    </div>
  );
}
