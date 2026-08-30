import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "@/lib/pdf/styles";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import type { ShootingDaySummary } from "@/lib/shooting-day-summary";

export function CallSheetDocument({
  projectName,
  summary,
}: {
  projectName: string;
  summary: ShootingDaySummary;
}) {
  const { shootingDay, sceneAssignments, locations, characters, crewMembers, breakdownElements } =
    summary;
  const callSheet = shootingDay.callSheet;

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <View>
            <Text style={pdfStyles.eyebrow}>Call Sheet</Text>
            <Text style={pdfStyles.title}>{projectName}</Text>
          </View>
          <Text style={pdfStyles.headerRight}>
            {shootingDay.date.toLocaleDateString("es-ES", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>

        <View style={[pdfStyles.section, pdfStyles.grid2]}>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Hora general de llamada</Text>
            <Text style={pdfStyles.value}>{callSheet?.generalCallTime ?? "—"}</Text>
          </View>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Localizaciones</Text>
            <Text style={pdfStyles.value}>
              {locations.map((l) => l.name).join(", ") || "—"}
            </Text>
          </View>
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionLabel}>Escenas</Text>
          <View style={pdfStyles.rowHeader}>
            <Text style={[pdfStyles.th, { width: 50 }]}>Hora</Text>
            <Text style={[pdfStyles.th, { flex: 1 }]}>Escena</Text>
            <Text style={[pdfStyles.th, { flex: 1 }]}>Personajes</Text>
          </View>
          {sceneAssignments.length === 0 ? (
            <Text style={[pdfStyles.td, { paddingVertical: 6 }]}>
              Sin escenas asignadas.
            </Text>
          ) : (
            sceneAssignments.map((assignment) => (
              <View key={assignment.id} style={pdfStyles.row}>
                <Text style={[pdfStyles.td, { width: 50 }]}>
                  {assignment.callTime ?? "—"}
                </Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>
                  Escena {assignment.scene.number} —{" "}
                  {INT_EXT_LABELS[assignment.scene.intExt]}{" "}
                  {DAY_PART_LABELS[assignment.scene.dayPart]}
                  {assignment.scene.location
                    ? ` · ${assignment.scene.location.name}`
                    : ""}
                </Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>
                  {assignment.scene.characters.map((c) => c.character.name).join(", ") ||
                    "—"}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={[pdfStyles.section, pdfStyles.grid3]}>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Cast</Text>
            <Text style={pdfStyles.value}>
              {characters
                .map((c) => `${c.name}${c.actor ? ` (${c.actor.name})` : ""}`)
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
