import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "@/lib/pdf/styles";
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
        <View style={pdfStyles.header}>
          <View>
            <Text style={pdfStyles.eyebrow}>Shot list</Text>
            <Text style={pdfStyles.title}>{projectName}</Text>
          </View>
        </View>

        {scenes.map((scene) => (
          <View key={scene.id} style={pdfStyles.section} wrap={false}>
            <Text style={pdfStyles.sectionLabel}>Escena {scene.number}</Text>
            <View style={pdfStyles.rowHeader}>
              <Text style={[pdfStyles.th, { width: 40 }]}>Plano</Text>
              <Text style={[pdfStyles.th, { width: 60 }]}>Tamaño</Text>
              <Text style={[pdfStyles.th, { width: 70 }]}>Ángulo/Mov.</Text>
              <Text style={[pdfStyles.th, { width: 90 }]}>Cámara/Lente</Text>
              <Text style={[pdfStyles.th, { width: 45 }]}>Duración</Text>
              <Text style={[pdfStyles.th, { flex: 1 }]}>Descripción</Text>
            </View>
            {scene.shots.map((shot) => (
              <View key={shot.id} style={pdfStyles.row}>
                <Text style={[pdfStyles.td, { width: 40 }]}>
                  {scene.number}.{shot.number}
                </Text>
                <Text style={[pdfStyles.td, { width: 60 }]}>
                  {shot.shotSize ?? "—"}
                </Text>
                <Text style={[pdfStyles.td, { width: 70 }]}>
                  {[shot.angle, shot.movement].filter(Boolean).join(" / ") || "—"}
                </Text>
                <Text style={[pdfStyles.td, { width: 90 }]}>
                  {[shot.camera, shot.lens].filter(Boolean).join(" / ") || "—"}
                </Text>
                <Text style={[pdfStyles.td, { width: 45 }]}>
                  {shot.durationSec ? `${shot.durationSec}s` : "—"}
                </Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>
                  {shot.description ?? "—"}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <View style={pdfStyles.footer} fixed>
          <Text>Versión definitiva — Taller</Text>
          <Text
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
