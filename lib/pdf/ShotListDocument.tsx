import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "@/lib/pdf/styles";
import { PdfHeader, PdfFooter, SectionTitle, rowStyle } from "@/lib/pdf/components";
import type { Prisma } from "@/lib/generated/prisma";

type SceneWithShots = Prisma.SceneGetPayload<{ include: { shots: true } }>;

export function ShotListDocument({
  projectName,
  scenes,
}: {
  projectName: string;
  scenes: SceneWithShots[];
}) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader eyebrow="Shot list" title={projectName} />

        {scenes.map((scene) => (
          <View key={scene.id} style={pdfStyles.section} wrap={false}>
            <SectionTitle>Escena {scene.number}</SectionTitle>
            <View style={pdfStyles.tableHeader}>
              <Text style={[pdfStyles.th, { width: 40 }]}>Plano</Text>
              <Text style={[pdfStyles.th, { width: 60 }]}>Tamaño</Text>
              <Text style={[pdfStyles.th, { width: 70 }]}>Ángulo/Mov.</Text>
              <Text style={[pdfStyles.th, { width: 82 }]}>Cámara/Lente</Text>
              <Text style={[pdfStyles.th, { width: 56 }]}>Duración</Text>
              <Text style={[pdfStyles.th, { flex: 1 }]}>Descripción</Text>
            </View>
            {scene.shots.map((shot, i) => (
              <View key={shot.id} style={rowStyle(i)}>
                <Text style={[pdfStyles.td, { width: 40 }]}>
                  {scene.number}.{shot.number}
                </Text>
                <Text style={[pdfStyles.td, { width: 60 }]}>
                  {shot.shotSize ?? "—"}
                </Text>
                <Text style={[pdfStyles.td, { width: 70 }]}>
                  {[shot.angle, shot.movement].filter(Boolean).join(" / ") || "—"}
                </Text>
                <Text style={[pdfStyles.td, { width: 82 }]}>
                  {[shot.camera, shot.lens].filter(Boolean).join(" / ") || "—"}
                </Text>
                <Text style={[pdfStyles.td, { width: 56 }]}>
                  {shot.durationSec ? `${shot.durationSec}s` : "—"}
                </Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>
                  {shot.description ?? "—"}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <PdfFooter projectName={projectName} />
      </Page>
    </Document>
  );
}
