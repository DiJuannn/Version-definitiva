import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type LegalSignature = {
  role: string;
  name: string;
  meta?: string;
};

const ink = "#1a1a1a";
const muted = "#6b6b66";

// Estilo deliberadamente distinto del resto de PDFs de la app
// (lib/pdf/styles.ts, pensado para dossiers/informes): un documento
// legal para imprimir y firmar tiene que parecerse a un documento
// legal de verdad — Times, prosa justificada con los datos ya
// incrustados en las frases, y un bloque de firma al final, no una
// lista de campos con etiquetas. Times-Roman/Bold son fuentes base del
// PDF (sin necesitar Font.register ni cargar nada por red).
const styles = StyleSheet.create({
  page: {
    paddingTop: 72,
    paddingBottom: 72,
    paddingHorizontal: 64,
    fontSize: 11,
    fontFamily: "Times-Roman",
    color: ink,
  },
  letterhead: {
    textAlign: "center",
    fontSize: 8,
    letterSpacing: 1.2,
    color: muted,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  caution: {
    textAlign: "center",
    fontSize: 8,
    fontFamily: "Times-Italic",
    color: muted,
    marginBottom: 20,
  },
  title: {
    textAlign: "center",
    fontSize: 15,
    fontFamily: "Times-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textDecoration: "underline",
    marginBottom: 28,
  },
  paragraph: {
    textAlign: "justify",
    lineHeight: 1.55,
    marginBottom: 14,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 56,
  },
  signatureBlock: {
    width: "44%",
  },
  signatureSpace: {
    height: 36,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: ink,
  },
  signatureName: {
    marginTop: 6,
    fontSize: 10,
    fontFamily: "Times-Bold",
  },
  signatureMeta: {
    marginTop: 1,
    fontSize: 9,
    color: muted,
  },
  signatureRole: {
    marginTop: 1,
    fontSize: 8,
    color: muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  disclaimer: {
    position: "absolute",
    bottom: 36,
    left: 64,
    right: 64,
    fontSize: 7,
    lineHeight: 1.4,
    color: muted,
    textAlign: "center",
  },
});

export function LegalDocumentTemplate({
  letterhead,
  caution,
  title,
  paragraphs,
  signatures,
  disclaimer,
}: {
  letterhead: string;
  caution?: string;
  title: string;
  paragraphs: string[];
  signatures: LegalSignature[];
  disclaimer: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.letterhead}>{letterhead}</Text>
        {caution && <Text style={styles.caution}>{caution}</Text>}
        <Text style={styles.title}>{title}</Text>

        {paragraphs.map((paragraph, i) => (
          <Text key={i} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}

        <View style={styles.signatureRow}>
          {signatures.map((sig) => (
            <View key={sig.role} style={styles.signatureBlock}>
              <View style={styles.signatureSpace} />
              <View style={styles.signatureLine} />
              <Text style={styles.signatureName}>{sig.name || "—"}</Text>
              {sig.meta && <Text style={styles.signatureMeta}>{sig.meta}</Text>}
              <Text style={styles.signatureRole}>{sig.role}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.disclaimer} fixed>
          {disclaimer}
        </Text>
      </Page>
    </Document>
  );
}
