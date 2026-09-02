import { Document, Page, Text, View } from "@react-pdf/renderer";
import { colors, pdfStyles } from "@/lib/pdf/styles";
import { PdfHeader, PdfFooter, SectionTitle, rowStyle } from "@/lib/pdf/components";
import {
  BREAKDOWN_CATEGORY_LABELS,
  DAY_PART_LABELS,
  INT_EXT_LABELS,
  INVENTORY_CATEGORY_LABELS,
} from "@/lib/labels";
import { BreakdownCategory } from "@/lib/generated/prisma";
import type { ProjectSummaryData } from "@/lib/project-summary";

const STATUS_LABELS: Record<string, string> = {
  DEVELOPMENT: "Desarrollo",
  PRE_PRODUCTION: "Preproducción",
  PRODUCTION: "Producción",
  POST_PRODUCTION: "Postproducción",
  FINISHED: "Finalizado",
};

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function formatDate(date: Date | null) {
  return date ? date.toLocaleDateString("es-ES") : "—";
}

// Mismos datos que la pantalla de Resumen (getProjectSummary) — nada se
// vuelve a calcular aquí, para que el dossier nunca se quede corto de lo
// que ya se ve en pantalla.
export function DossierDocument({ summary }: { summary: ProjectSummaryData }) {
  const {
    project,
    locations,
    shotsTotal,
    storyboardFramesCount,
    budgetCategoriesWithTotals,
    budgetGrandTotal,
    inventoryItems,
    vehicles,
    shootingDaysWithNeeds,
  } = summary;

  const breakdownByCategory = Object.values(BreakdownCategory).map((category) => ({
    category,
    items: project.breakdownElements.filter((el) => el.category === category),
  }));

  const subtitle = [
    project.director && `Dirección: ${project.director}`,
    project.producer && `Producción: ${project.producer}`,
  ]
    .filter(Boolean)
    .join("   ·   ");

  return (
    <Document>
      {/* Portada */}
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.brandBar} fixed />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text
            style={{
              fontSize: 9,
              letterSpacing: 3,
              color: colors.accent,
              textTransform: "uppercase",
              fontFamily: "Helvetica-Bold",
              marginBottom: 18,
            }}
          >
            Dossier de producción
          </Text>
          <Text
            style={{
              fontSize: 34,
              fontFamily: "Helvetica-Bold",
              textTransform: "uppercase",
              lineHeight: 1.15,
            }}
          >
            {project.name}
          </Text>
          <View
            style={{
              width: 64,
              height: 3,
              backgroundColor: colors.accent,
              marginTop: 22,
              marginBottom: 18,
            }}
          />
          {subtitle && <Text style={{ fontSize: 11, color: colors.muted }}>{subtitle}</Text>}
        </View>
        <Text style={{ fontSize: 8, color: colors.muted }}>
          Generado el{" "}
          {new Date().toLocaleDateString("es-ES", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}{" "}
          — Versión definitiva · Taller
        </Text>
      </Page>

      {/* Resumen */}
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader eyebrow="Dossier de producción" title="Resumen" />

        <View style={[pdfStyles.section, pdfStyles.grid3]}>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Tipo</Text>
            <Text style={pdfStyles.value}>{project.type ?? "—"}</Text>
          </View>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Estado</Text>
            <Text style={pdfStyles.value}>{STATUS_LABELS[project.status] ?? project.status}</Text>
          </View>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Duración</Text>
            <Text style={pdfStyles.value}>{project.durationLabel ?? "—"}</Text>
          </View>
        </View>
        <View style={[pdfStyles.section, pdfStyles.grid3]}>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Director</Text>
            <Text style={pdfStyles.value}>{project.director ?? "—"}</Text>
          </View>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Producción</Text>
            <Text style={pdfStyles.value}>{project.producer ?? "—"}</Text>
          </View>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Fechas</Text>
            <Text style={pdfStyles.value}>
              {formatDate(project.startDate)} — {formatDate(project.endDate)}
            </Text>
          </View>
        </View>
        {project.notes && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionLabel}>Notas</Text>
            <Text style={pdfStyles.value}>{project.notes}</Text>
          </View>
        )}

        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.accentSoft,
            padding: 14,
            marginTop: 8,
            marginBottom: 16,
          }}
        >
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Escenas</Text>
            <Text style={pdfStyles.statValue}>{project.scenes.length}</Text>
          </View>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Días de rodaje</Text>
            <Text style={pdfStyles.statValue}>{project.shootingDays.length}</Text>
          </View>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Presupuesto total</Text>
            <Text style={[pdfStyles.statValue, { color: colors.accent }]}>
              {currency(budgetGrandTotal)}
            </Text>
          </View>
        </View>
        <View style={[pdfStyles.section, pdfStyles.grid3]}>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Planos definidos</Text>
            <Text style={pdfStyles.value}>{shotsTotal}</Text>
          </View>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Viñetas de storyboard</Text>
            <Text style={pdfStyles.value}>{storyboardFramesCount}</Text>
          </View>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Equipo técnico</Text>
            <Text style={pdfStyles.value}>{project.crewMembers.length} personas</Text>
          </View>
        </View>

        <PdfFooter projectName={project.name} />
      </Page>

      {/* Escenas */}
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader eyebrow="Dossier de producción" title="Escenas" />
        <View style={pdfStyles.tableHeader}>
          <Text style={[pdfStyles.th, { width: 40 }]}>Nº</Text>
          <Text style={[pdfStyles.th, { width: 90 }]}>INT/EXT · Día</Text>
          <Text style={[pdfStyles.th, { width: 110 }]}>Localización</Text>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Personajes</Text>
        </View>
        {project.scenes.length === 0 ? (
          <Text style={[pdfStyles.td, { paddingVertical: 6 }]}>Sin escenas.</Text>
        ) : (
          project.scenes.map((scene, i) => (
            <View key={scene.id} style={rowStyle(i)}>
              <Text style={[pdfStyles.td, { width: 40 }]}>{scene.number}</Text>
              <Text style={[pdfStyles.td, { width: 90 }]}>
                {INT_EXT_LABELS[scene.intExt]} · {DAY_PART_LABELS[scene.dayPart]}
              </Text>
              <Text style={[pdfStyles.td, { width: 110 }]}>
                {scene.location?.name ?? "—"}
              </Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>
                {scene.characters.map((c) => c.character.name).join(", ") || "—"}
              </Text>
            </View>
          ))
        )}
        <PdfFooter projectName={project.name} />
      </Page>

      {/* Personajes, actores y localizaciones */}
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader eyebrow="Dossier de producción" title="Personajes y actores" />
        <View style={pdfStyles.tableHeader}>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Personaje</Text>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Actor/Actriz</Text>
        </View>
        {project.characters.length === 0 ? (
          <Text style={[pdfStyles.td, { paddingVertical: 6 }]}>Sin personajes.</Text>
        ) : (
          project.characters.map((character, i) => (
            <View key={character.id} style={rowStyle(i)}>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{character.name}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{character.actor?.name ?? "—"}</Text>
            </View>
          ))
        )}

        <View style={{ marginTop: 22 }}>
          <SectionTitle>Localizaciones</SectionTitle>
        </View>
        <View style={pdfStyles.tableHeader}>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Nombre</Text>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Escenas</Text>
        </View>
        {locations.length === 0 ? (
          <Text style={[pdfStyles.td, { paddingVertical: 6 }]}>Sin localizaciones.</Text>
        ) : (
          locations.map((location, i) => (
            <View key={location.id} style={rowStyle(i)}>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{location.name}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{location.sceneCount}</Text>
            </View>
          ))
        )}
        <PdfFooter projectName={project.name} />
      </Page>

      {/* Equipo técnico */}
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader eyebrow="Dossier de producción" title="Equipo técnico" />
        <View style={pdfStyles.tableHeader}>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Nombre</Text>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Rol</Text>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Contacto</Text>
        </View>
        {project.crewMembers.length === 0 ? (
          <Text style={[pdfStyles.td, { paddingVertical: 6 }]}>Sin equipo técnico.</Text>
        ) : (
          project.crewMembers.map((member, i) => (
            <View key={member.id} style={rowStyle(i)}>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{member.name}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{member.role ?? "—"}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>
                {[member.email, member.phone].filter(Boolean).join(" · ") || "—"}
              </Text>
            </View>
          ))
        )}
        <PdfFooter projectName={project.name} />
      </Page>

      {/* Desglose */}
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader eyebrow="Dossier de producción" title="Desglose" />
        {project.breakdownElements.length === 0 ? (
          <Text style={pdfStyles.td}>Sin elementos de desglose.</Text>
        ) : (
          breakdownByCategory
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <View key={group.category} style={pdfStyles.section} wrap={false}>
                <Text style={pdfStyles.sectionLabel}>
                  {BREAKDOWN_CATEGORY_LABELS[group.category]} ({group.items.length})
                </Text>
                <Text style={pdfStyles.td}>
                  {group.items.map((item) => item.name).join(", ")}
                </Text>
              </View>
            ))
        )}
        <PdfFooter projectName={project.name} />
      </Page>

      {/* Inventario y vehículos */}
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader eyebrow="Dossier de producción" title="Inventario" />
        <View style={pdfStyles.tableHeader}>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Elemento</Text>
          <Text style={[pdfStyles.th, { width: 90 }]}>Categoría</Text>
          <Text style={[pdfStyles.th, { width: 90 }]}>Días reservado</Text>
        </View>
        {inventoryItems.length === 0 ? (
          <Text style={[pdfStyles.td, { paddingVertical: 6 }]}>Sin equipo reservado.</Text>
        ) : (
          inventoryItems.map((item, i) => (
            <View key={item.id} style={rowStyle(i)}>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{item.name}</Text>
              <Text style={[pdfStyles.td, { width: 90 }]}>
                {INVENTORY_CATEGORY_LABELS[item.category as keyof typeof INVENTORY_CATEGORY_LABELS] ??
                  item.category}
              </Text>
              <Text style={[pdfStyles.td, { width: 90 }]}>{item.daysCount}</Text>
            </View>
          ))
        )}

        <View style={{ marginTop: 22 }}>
          <SectionTitle>Vehículos</SectionTitle>
        </View>
        <View style={pdfStyles.tableHeader}>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Nombre</Text>
          <Text style={[pdfStyles.th, { width: 90 }]}>Matrícula</Text>
          <Text style={[pdfStyles.th, { width: 90 }]}>Días reservado</Text>
        </View>
        {vehicles.length === 0 ? (
          <Text style={[pdfStyles.td, { paddingVertical: 6 }]}>Sin vehículos reservados.</Text>
        ) : (
          vehicles.map((vehicle, i) => (
            <View key={vehicle.id} style={rowStyle(i)}>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{vehicle.name}</Text>
              <Text style={[pdfStyles.td, { width: 90 }]}>{vehicle.plate ?? "—"}</Text>
              <Text style={[pdfStyles.td, { width: 90 }]}>{vehicle.daysCount}</Text>
            </View>
          ))
        )}
        <PdfFooter projectName={project.name} />
      </Page>

      {/* Plan de rodaje — qué llevar cada día */}
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader eyebrow="Dossier de producción" title="Plan de rodaje" />
        {shootingDaysWithNeeds.length === 0 ? (
          <Text style={pdfStyles.td}>Sin días de rodaje planificados.</Text>
        ) : (
          shootingDaysWithNeeds.map((day) => (
            <View key={day.id} style={pdfStyles.section} wrap={false}>
              <Text style={pdfStyles.sectionLabel}>
                {day.date.toLocaleDateString("es-ES", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              {day.scenes.map((assignment) => (
                <Text key={assignment.id} style={[pdfStyles.td, { paddingVertical: 2 }]}>
                  {assignment.callTime ?? "—"} · Escena {assignment.scene.number}
                </Text>
              ))}
              <Text style={[pdfStyles.td, { marginTop: 4, color: colors.muted }]}>
                Equipo: {day.crewNames.join(", ") || "—"}
              </Text>
              <Text style={[pdfStyles.td, { color: colors.muted }]}>
                Material: {day.itemNames.join(", ") || "—"}
              </Text>
              <Text style={[pdfStyles.td, { color: colors.muted }]}>
                Vehículos: {day.vehicleNames.join(", ") || "—"}
              </Text>
            </View>
          ))
        )}
        <PdfFooter projectName={project.name} />
      </Page>

      {/* Presupuesto */}
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader eyebrow="Dossier de producción" title="Presupuesto" />
        {budgetCategoriesWithTotals.length === 0 ? (
          <Text style={pdfStyles.td}>Sin presupuesto definido.</Text>
        ) : (
          <>
            {budgetCategoriesWithTotals.map((category, i) => (
              <View key={category.id} style={rowStyle(i)}>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{category.name}</Text>
                <Text style={pdfStyles.td}>{currency(category.total)}</Text>
              </View>
            ))}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: colors.ink,
                paddingVertical: 10,
                paddingHorizontal: 10,
                marginTop: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Helvetica-Bold",
                  color: colors.bg,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Total
              </Text>
              <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: colors.accent }}>
                {currency(budgetGrandTotal)}
              </Text>
            </View>
          </>
        )}
        <PdfFooter projectName={project.name} />
      </Page>
    </Document>
  );
}
