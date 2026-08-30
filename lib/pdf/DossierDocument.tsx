import { Document, Page, Text, View } from "@react-pdf/renderer";
import { colors, pdfStyles } from "@/lib/pdf/styles";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import type { Prisma } from "@/lib/generated/prisma";

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

type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: {
    scenes: {
      include: {
        location: true;
        characters: { include: { character: true } };
      };
    };
    actors: { include: { characters: true } };
    characters: true;
    shootingDays: {
      include: { scenes: { include: { scene: true } } };
    };
    budgetCategories: { include: { items: true } };
  };
}>;

export function DossierDocument({ project }: { project: ProjectWithRelations }) {
  const locationsUsed = [
    ...new Map(
      project.scenes
        .filter((scene) => scene.location)
        .map((scene) => [scene.location!.id, scene.location!]),
    ).values(),
  ];

  const grandTotal = project.budgetCategories.reduce((sum, category) => {
    const categoryTotal = category.items.reduce((itemSum, item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const taxRate = Number(item.taxRate);
      return itemSum + quantity * unitPrice * (1 + taxRate / 100);
    }, 0);
    return sum + categoryTotal;
  }, 0);

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
              {currency(grandTotal)}
            </Text>
          </View>
        </View>

        <View style={pdfStyles.footer} fixed>
          <Text>Versión definitiva — Taller</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* Escenas */}
      <Page size="A4" style={pdfStyles.page}>
        <Text style={[pdfStyles.title, { fontSize: 14, marginBottom: 12 }]}>Escenas</Text>
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
        <View style={pdfStyles.footer} fixed>
          <Text>Versión definitiva — Taller</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* Personajes y actores */}
      <Page size="A4" style={pdfStyles.page}>
        <Text style={[pdfStyles.title, { fontSize: 14, marginBottom: 12 }]}>
          Personajes y actores
        </Text>
        <View style={pdfStyles.rowHeader}>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Personaje</Text>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Actor/Actriz</Text>
        </View>
        {project.characters.length === 0 ? (
          <Text style={[pdfStyles.td, { paddingVertical: 6 }]}>Sin personajes.</Text>
        ) : (
          project.characters.map((character) => {
            const actor = project.actors.find((a) =>
              a.characters.some((c) => c.id === character.id),
            );
            return (
              <View key={character.id} style={pdfStyles.row}>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{character.name}</Text>
                <Text style={[pdfStyles.td, { flex: 1 }]}>{actor?.name ?? "—"}</Text>
              </View>
            );
          })
        )}

        <Text style={[pdfStyles.sectionLabel, { marginTop: 20 }]}>Localizaciones</Text>
        <View style={pdfStyles.rowHeader}>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Nombre</Text>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Dirección</Text>
          <Text style={[pdfStyles.th, { flex: 1 }]}>Contacto</Text>
        </View>
        {locationsUsed.length === 0 ? (
          <Text style={[pdfStyles.td, { paddingVertical: 6 }]}>Sin localizaciones.</Text>
        ) : (
          locationsUsed.map((location) => (
            <View key={location.id} style={pdfStyles.row}>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{location.name}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{location.address ?? "—"}</Text>
              <Text style={[pdfStyles.td, { flex: 1 }]}>{location.contactName ?? "—"}</Text>
            </View>
          ))
        )}
        <View style={pdfStyles.footer} fixed>
          <Text>Versión definitiva — Taller</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* Plan de rodaje */}
      <Page size="A4" style={pdfStyles.page}>
        <Text style={[pdfStyles.title, { fontSize: 14, marginBottom: 12 }]}>
          Plan de rodaje
        </Text>
        {project.shootingDays.length === 0 ? (
          <Text style={pdfStyles.td}>Sin días de rodaje planificados.</Text>
        ) : (
          project.shootingDays.map((day) => (
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
            </View>
          ))
        )}
        <View style={pdfStyles.footer} fixed>
          <Text>Versión definitiva — Taller</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* Presupuesto */}
      <Page size="A4" style={pdfStyles.page}>
        <Text style={[pdfStyles.title, { fontSize: 14, marginBottom: 12 }]}>
          Presupuesto
        </Text>
        {project.budgetCategories.length === 0 ? (
          <Text style={pdfStyles.td}>Sin presupuesto definido.</Text>
        ) : (
          <>
            {project.budgetCategories.map((category) => {
              const categoryTotal = category.items.reduce((sum, item) => {
                const quantity = Number(item.quantity);
                const unitPrice = Number(item.unitPrice);
                const taxRate = Number(item.taxRate);
                return sum + quantity * unitPrice * (1 + taxRate / 100);
              }, 0);
              return (
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
                  <Text style={pdfStyles.td}>{currency(categoryTotal)}</Text>
                </View>
              );
            })}
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
                {currency(grandTotal)}
              </Text>
            </View>
          </>
        )}
        <View style={pdfStyles.footer} fixed>
          <Text>Versión definitiva — Taller</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
