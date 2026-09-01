import { Document, Page, Text, View } from "@react-pdf/renderer";
import { colors, pdfStyles } from "@/lib/pdf/styles";
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

function Footer() {
  return (
    <View style={pdfStyles.footer} fixed>
      <Text>Versión definitiva — Taller</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function PageTitle({ children }: { children: string }) {
  return <Text style={[pdfStyles.title, { fontSize: 14, marginBottom: 12 }]}>{children}</Text>;
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

  return (
    <Document>
      {/* Portada */}
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <View>
            <Text style={pdfStyles.eyebrow}>Dossier de producción</Text>
            <Text style={pdfStyles.title}>{project.name}</Text>
          </View>
        </View>

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

        <View style={[pdfStyles.section, pdfStyles.grid3]}>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Escenas</Text>
            <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold" }}>
              {project.scenes.length}
            </Text>
          </View>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Días de rodaje</Text>
            <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold" }}>
              {project.shootingDays.length}
            </Text>
          </View>
          <View style={pdfStyles.col}>
            <Text style={pdfStyles.sectionLabel}>Presupuesto total</Text>
            <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: colors.accent }}>
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

        <Footer />
      </Page>

      {/* Escenas */}
      <Page size="A4" style={pdfStyles.page}>
        <PageTitle>Escenas</PageTitle>
        <View style={pdfStyles.rowHeader}>
          <Text style={[pdfStyles.th, { width: 40 }]}>Nº</Text>
          <Text style={[pdfStyles.th, { width: 90 }]}>INT/EXT · Día</Text>
          <Text style={[pdfStyles.th, { width: 110 }]}>Localización</Text>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Personajes</Text>
        </View>
        {project.scenes.length === 0 ? (
          <Text style={[pdfStyles.td, { paddingVertical: 6 }]}>Sin escenas.</Text>
        ) : (
          project.scenes.map((scene) => (
            <View key={scene.id} style={pdfStyles.row}>
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
        <Footer />
      </Page>

      {/* Personajes, actores y localizaciones */}
      <Page size="A4" style={pdfStyles.page}>
        <PageTitle>Personajes y actores</PageTitle>
        <View style={pdfStyles.rowHeader}>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Personaje</Text>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Actor/Actriz</Text>
        </View>
        {project.characters.length === 0 ? (
          <Text style={[pdfStyles.td, { paddingVertical: 6 }]}>Sin personajes.</Text>
        ) : (
          project.characters.map((character) => (
            <View key={character.id} style={pdfStyles.row}>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{character.name}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{character.actor?.name ?? "—"}</Text>
            </View>
          ))
        )}

        <Text style={[pdfStyles.sectionLabel, { marginTop: 20 }]}>Localizaciones</Text>
        <View style={pdfStyles.rowHeader}>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Nombre</Text>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Escenas</Text>
        </View>
        {locations.length === 0 ? (
          <Text style={[pdfStyles.td, { paddingVertical: 6 }]}>Sin localizaciones.</Text>
        ) : (
          locations.map((location) => (
            <View key={location.id} style={pdfStyles.row}>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{location.name}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{location.sceneCount}</Text>
            </View>
          ))
        )}
        <Footer />
      </Page>

      {/* Equipo técnico */}
      <Page size="A4" style={pdfStyles.page}>
        <PageTitle>Equipo técnico</PageTitle>
        <View style={pdfStyles.rowHeader}>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Nombre</Text>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Rol</Text>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Contacto</Text>
        </View>
        {project.crewMembers.length === 0 ? (
          <Text style={[pdfStyles.td, { paddingVertical: 6 }]}>Sin equipo técnico.</Text>
        ) : (
          project.crewMembers.map((member) => (
            <View key={member.id} style={pdfStyles.row}>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{member.name}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{member.role ?? "—"}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>
                {[member.email, member.phone].filter(Boolean).join(" · ") || "—"}
              </Text>
            </View>
          ))
        )}
        <Footer />
      </Page>

      {/* Desglose */}
      <Page size="A4" style={pdfStyles.page}>
        <PageTitle>Desglose</PageTitle>
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
        <Footer />
      </Page>

      {/* Inventario y vehículos */}
      <Page size="A4" style={pdfStyles.page}>
        <PageTitle>Inventario</PageTitle>
        <View style={pdfStyles.rowHeader}>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Elemento</Text>
          <Text style={[pdfStyles.th, { width: 90 }]}>Categoría</Text>
          <Text style={[pdfStyles.th, { width: 90 }]}>Días reservado</Text>
        </View>
        {inventoryItems.length === 0 ? (
          <Text style={[pdfStyles.td, { paddingVertical: 6 }]}>Sin equipo reservado.</Text>
        ) : (
          inventoryItems.map((item) => (
            <View key={item.id} style={pdfStyles.row}>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{item.name}</Text>
              <Text style={[pdfStyles.td, { width: 90 }]}>
                {INVENTORY_CATEGORY_LABELS[item.category as keyof typeof INVENTORY_CATEGORY_LABELS] ??
                  item.category}
              </Text>
              <Text style={[pdfStyles.td, { width: 90 }]}>{item.daysCount}</Text>
            </View>
          ))
        )}

        <Text style={[pdfStyles.sectionLabel, { marginTop: 20 }]}>Vehículos</Text>
        <View style={pdfStyles.rowHeader}>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Nombre</Text>
          <Text style={[pdfStyles.th, { width: 90 }]}>Matrícula</Text>
          <Text style={[pdfStyles.th, { width: 90 }]}>Días reservado</Text>
        </View>
        {vehicles.length === 0 ? (
          <Text style={[pdfStyles.td, { paddingVertical: 6 }]}>Sin vehículos reservados.</Text>
        ) : (
          vehicles.map((vehicle) => (
            <View key={vehicle.id} style={pdfStyles.row}>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{vehicle.name}</Text>
              <Text style={[pdfStyles.td, { width: 90 }]}>{vehicle.plate ?? "—"}</Text>
              <Text style={[pdfStyles.td, { width: 90 }]}>{vehicle.daysCount}</Text>
            </View>
          ))
        )}
        <Footer />
      </Page>

      {/* Plan de rodaje — qué llevar cada día */}
      <Page size="A4" style={pdfStyles.page}>
        <PageTitle>Plan de rodaje</PageTitle>
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
        <Footer />
      </Page>

      {/* Presupuesto */}
      <Page size="A4" style={pdfStyles.page}>
        <PageTitle>Presupuesto</PageTitle>
        {budgetCategoriesWithTotals.length === 0 ? (
          <Text style={pdfStyles.td}>Sin presupuesto definido.</Text>
        ) : (
          <>
            {budgetCategoriesWithTotals.map((category) => (
              <View
                key={category.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.line,
                  paddingVertical: 6,
                }}
              >
                <Text style={pdfStyles.td}>{category.name}</Text>
                <Text style={pdfStyles.td}>{currency(category.total)}</Text>
              </View>
            ))}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                borderTopWidth: 1.5,
                borderTopColor: colors.ink,
                paddingTop: 8,
                marginTop: 8,
              }}
            >
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold" }}>TOTAL</Text>
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: colors.accent }}>
                {currency(budgetGrandTotal)}
              </Text>
            </View>
          </>
        )}
        <Footer />
      </Page>
    </Document>
  );
}
