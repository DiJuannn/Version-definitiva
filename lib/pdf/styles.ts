import { StyleSheet } from "@react-pdf/renderer";

export const colors = {
  ink: "#0a0a0a",
  muted: "#6b6b66",
  line: "#e2dfd6",
  accent: "#c1440e",
  accentSoft: "#f4e3da",
  bg: "#ffffff",
};

// Fuentes base del propio PDF (Helvetica) — sin Font.register ni carga
// por red: ningún riesgo de que falle o tarde una descarga por un fallo
// de conexión al generar el PDF. Todo el "premium" viene de la
// jerarquía tipográfica, el espaciado y el acento naranja bien usado,
// no de la fuente en sí.
export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: colors.ink,
  },
  brandBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    backgroundColor: colors.accent,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
    paddingBottom: 12,
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 8.5,
    letterSpacing: 2,
    color: colors.accent,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    marginBottom: 5,
  },
  title: {
    fontSize: 23,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  headerRight: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitleWrap: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  sectionRule: {
    width: 28,
    height: 2.5,
    backgroundColor: colors.accent,
  },
  sectionLabel: {
    fontSize: 8,
    letterSpacing: 1.2,
    color: colors.muted,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  grid2: {
    flexDirection: "row",
    gap: 20,
  },
  grid3: {
    flexDirection: "row",
    gap: 20,
  },
  col: {
    flex: 1,
  },
  value: {
    fontSize: 10.5,
  },
  statValue: {
    fontSize: 19,
    fontFamily: "Helvetica-Bold",
  },
  // Cabecera de tabla: fondo oscuro sólido, texto claro en versalitas —
  // se lee como una tabla "de verdad" en vez de una línea con etiquetas
  // pequeñas encima de los datos.
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.ink,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  th: {
    fontSize: 7.5,
    letterSpacing: 0.8,
    color: colors.bg,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.line,
  },
  // Aplicado a filas alternas (índice impar) para que las tablas largas
  // se lean sin perder la línea — cebreado muy sutil, casi imperceptible
  // en pantalla pero ayuda mucho al imprimir en blanco y negro.
  rowAlt: {
    backgroundColor: "#faf9f6",
  },
  td: {
    fontSize: 9,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7.5,
    color: colors.muted,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
});
