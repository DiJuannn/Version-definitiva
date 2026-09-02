import { Document, Page, Text, View } from "@react-pdf/renderer";
import { colors, pdfStyles } from "@/lib/pdf/styles";

export type LegalField = { label: string; value: string };
export type LegalFieldGroup = { label: string; fields: LegalField[] };

// Layout compartido por las 5 plantillas legales — cada una aporta su
// propio texto (título, párrafos, campos, líneas de firma), esto solo
// pone en pantalla el mismo aspecto para todas y, sobre todo, el aviso
// legal obligatorio al final de cada una.
export function LegalDocumentTemplate({
  eyebrow,
  title,
  fieldGroups,
  bodyText,
  signatureLines,
}: {
  eyebrow: string;
  title: string;
  fieldGroups: LegalFieldGroup[];
  bodyText: string[];
  signatureLines: string[];
}) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <View>
            <Text style={pdfStyles.eyebrow}>{eyebrow}</Text>
            <Text style={pdfStyles.title}>{title}</Text>
          </View>
        </View>

        {fieldGroups.map((group) => (
          <View key={group.label} style={pdfStyles.section}>
            <Text style={pdfStyles.sectionLabel}>{group.label}</Text>
            {group.fields.map((field) => (
              <View key={field.label} style={{ flexDirection: "row", marginBottom: 3 }}>
                <Text style={{ fontSize: 9, width: 150, color: colors.muted }}>
                  {field.label}
                </Text>
                <Text style={{ fontSize: 9, flex: 1 }}>{field.value || "—"}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={[pdfStyles.section, { marginTop: 6 }]}>
          {bodyText.map((paragraph, i) => (
            <Text key={i} style={{ fontSize: 9, lineHeight: 1.5, marginBottom: 8 }}>
              {paragraph}
            </Text>
          ))}
        </View>

        <View style={{ marginTop: 24, flexDirection: "row", gap: 40 }}>
          {signatureLines.map((label) => (
            <View key={label} style={{ flex: 1 }}>
              <View style={{ borderTopWidth: 1, borderTopColor: colors.ink, marginTop: 46 }} />
              <Text style={{ fontSize: 8, marginTop: 4, color: colors.muted }}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={{ position: "absolute", bottom: 44, left: 32, right: 32 }}>
          <Text style={{ fontSize: 7, color: colors.muted, lineHeight: 1.4 }}>
            Esta plantilla es orientativa y no sustituye asesoría legal profesional. La
            validez y los requisitos de este documento varían según el país y la
            jurisdicción — revísalo con un profesional antes de usarlo de forma
            vinculante.
          </Text>
        </View>

        <View style={pdfStyles.footer} fixed>
          <Text>Versión definitiva — Taller</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
