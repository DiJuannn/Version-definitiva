import { Document, Page, Text, View } from "@react-pdf/renderer";
import { colors, pdfStyles } from "@/lib/pdf/styles";
import { PdfHeader, PdfFooter, SectionTitle, Watermark, rowStyle } from "@/lib/pdf/components";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import type { ShootingDaySummary } from "@/lib/shooting-day-summary";
import { formatHHMM } from "@/lib/schedule-plan";

export function CallSheetDocument({
  projectName,
  summary,
  watermark,
}: {
  projectName: string;
  summary: ShootingDaySummary;
  // Solo en el plan Free — Pro descarga el PDF limpio.
  watermark?: boolean;
}) {
  const {
    shootingDay,
    sceneAssignments,
    charactersByAssignment,
    locations,
    characters,
    crewMembers,
    breakdownElements,
    runOrder,
  } = summary;
  const callSheet = shootingDay.callSheet;
  const hasRun = runOrder.blocks.length > 0;
  const characterName = new Map(characters.map((c) => [c.id, c.name]));

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {watermark && <Watermark />}
        <PdfHeader
          eyebrow="Hoja de llamada"
          title={projectName}
          meta={shootingDay.date.toLocaleDateString("es-ES", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        />

        <View style={[pdfStyles.section, pdfStyles.grid2, { marginBottom: 22 }]}>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Hora general de llamada</Text>
            <Text style={pdfStyles.value}>{runOrder.callTime ?? callSheet?.generalCallTime ?? "—"}</Text>
          </View>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Localizaciones</Text>
            {locations.length === 0 ? (
              <Text style={pdfStyles.value}>—</Text>
            ) : (
              locations.map((l) => (
                <Text key={l.id} style={[pdfStyles.value, { marginBottom: 3 }]}>
                  {l.name}
                  {l.address ? <Text style={{ color: colors.muted }}> — {l.address}</Text> : ""}
                </Text>
              ))
            )}
          </View>
        </View>

        {hasRun && (
          <View style={[pdfStyles.section, { marginBottom: 22 }]}>
            <SectionTitle>Orden de rodaje{runOrder.wrap ? ` · fin previsto ${runOrder.wrap}` : ""}</SectionTitle>
            <View style={[rowStyle(0), { paddingVertical: 6 }]}>
              <Text style={[pdfStyles.td, { width: 50 }]}>{runOrder.callTime ?? "—"}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>Llamada general · preparación {runOrder.prepMin} min</Text>
            </View>
            {runOrder.blocks.map((block, i) => (
              <View key={block.id} wrap={false} style={{ marginBottom: 4 }}>
                <View style={[rowStyle(i + 1), { paddingVertical: 6 }]}>
                  <Text style={[pdfStyles.td, { width: 50 }]}>{formatHHMM(block.start)}</Text>
                  <Text style={[pdfStyles.td, { flex: 1, fontWeight: 700 }]}>
                    {block.kind === "SCENE" && block.scene
                      ? `${block.label.split(" · ")[0]} · Escena ${block.scene.number} entera${block.location ? ` · ${block.location}` : ""}`
                      : block.label}
                    {block.kind !== "SHOTS" && block.kind !== "SCENE" && block.minutes > 0 ? ` · ${block.minutes} min` : ""}
                  </Text>
                </View>
                {block.shots.map((shot) => (
                  <View
                    key={shot.id}
                    style={{ flexDirection: "row", marginLeft: 50, paddingLeft: 8, paddingVertical: 3, borderLeftWidth: 1.5, borderLeftColor: colors.line }}
                  >
                    <Text style={[pdfStyles.td, { width: 36, color: colors.muted }]}>{formatHHMM(shot.start)}</Text>
                    <Text style={[pdfStyles.td, { width: 32 }]}>
                      {shot.sceneNumber}.{shot.number}
                    </Text>
                    <Text style={[pdfStyles.td, { width: 32, color: colors.muted }]}>{shot.shotSize ?? ""}</Text>
                    <Text style={[pdfStyles.td, { flex: 1 }]}>{shot.description ?? ""}</Text>
                    <Text style={[pdfStyles.td, { width: 110, color: colors.muted }]}>
                      {shot.characterIds.map((id) => characterName.get(id)).filter(Boolean).join(", ")}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
            {runOrder.wrap && (
              <View style={[rowStyle(runOrder.blocks.length + 1), { paddingVertical: 6 }]}>
                <Text style={[pdfStyles.td, { width: 50 }]}>{runOrder.wrap}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>Fin de rodaje previsto</Text>
              </View>
            )}
          </View>
        )}

        {!hasRun && (
        <View style={[pdfStyles.section, { marginBottom: 22 }]}>
          <SectionTitle>Escenas</SectionTitle>
          <View style={pdfStyles.tableHeader}>
            <Text style={[pdfStyles.th, { width: 50 }]}>Hora</Text>
            <Text style={[pdfStyles.th, { flex: 1 }]}>Escena</Text>
            <Text style={[pdfStyles.th, { flex: 1 }]}>Personajes</Text>
          </View>
          {sceneAssignments.length === 0 ? (
            <Text style={[pdfStyles.td, { paddingVertical: 6 }]}>
              Sin escenas asignadas.
            </Text>
          ) : (
            sceneAssignments.map((assignment, i) => (
              <View key={assignment.id} wrap={false} style={{ marginBottom: 4 }}>
                <View style={[rowStyle(i), { paddingVertical: 8 }]}>
                  <Text style={[pdfStyles.td, { width: 50 }]}>
                    {assignment.callTime ?? "—"}
                  </Text>
                  <Text style={[pdfStyles.td, { flex: 1, lineHeight: 1.4 }]}>
                    Escena {assignment.scene.number} —{" "}
                    {INT_EXT_LABELS[assignment.scene.intExt]}{" "}
                    {DAY_PART_LABELS[assignment.scene.dayPart]}
                    {assignment.scene.location
                      ? ` · ${assignment.scene.location.name}`
                      : ""}
                  </Text>
                  <Text style={[pdfStyles.td, { flex: 1, lineHeight: 1.4 }]}>
                    {(charactersByAssignment.get(assignment.id) ?? [])
                      .map((c) => c.character.name)
                      .join(", ") || "—"}
                  </Text>
                </View>
                {/* Planos que se ruedan este día (si la escena tiene shot list). */}
                {assignment.scene.shots.map((shot) => (
                  <View
                    key={shot.id}
                    style={{
                      flexDirection: "row",
                      marginLeft: 50,
                      paddingLeft: 8,
                      paddingVertical: 3.5,
                      borderLeftWidth: 1.5,
                      borderLeftColor: colors.line,
                    }}
                  >
                    <Text style={[pdfStyles.td, { width: 32, color: colors.muted }]}>
                      {assignment.scene.number}.{shot.number}
                    </Text>
                    <Text style={[pdfStyles.td, { width: 40, color: colors.muted }]}>{shot.shotSize ?? ""}</Text>
                    <Text style={[pdfStyles.td, { flex: 1, color: colors.muted }]}>
                      {[shot.description, shot.movement].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
        )}

        <View style={[pdfStyles.section, pdfStyles.grid3, { marginBottom: 22 }]}>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Cast</Text>
            <Text style={pdfStyles.value}>
              {characters
                .map(
                  (c) =>
                    `${c.name}${c.actor ? ` (${c.actor.name})` : ""}${
                      runOrder.castCalls[c.id] ? ` · citación ${runOrder.castCalls[c.id].call}` : ""
                    }`,
                )
                .join(", ") || "—"}
            </Text>
          </View>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Equipo técnico</Text>
            <Text style={pdfStyles.value}>
              {crewMembers.map((c) => c.name).join(", ") || "—"}
            </Text>
          </View>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Atrezzo / equipo</Text>
            <Text style={pdfStyles.value}>
              {breakdownElements.map((b) => b.name).join(", ") || "—"}
            </Text>
          </View>
        </View>

        <View style={[pdfStyles.section, pdfStyles.grid3]}>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Transporte</Text>
            <Text style={pdfStyles.value}>{callSheet?.transportNotes ?? "—"}</Text>
          </View>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Catering</Text>
            <Text style={pdfStyles.value}>{callSheet?.cateringNotes ?? "—"}</Text>
          </View>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Notas adicionales</Text>
            <Text style={pdfStyles.value}>{callSheet?.additionalNotes ?? "—"}</Text>
          </View>
        </View>

        <PdfFooter projectName={projectName} />
      </Page>
    </Document>
  );
}
