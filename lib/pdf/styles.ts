import { StyleSheet } from "@react-pdf/renderer";

export const colors = {
  ink: "#0a0a0a",
  muted: "#5c5c58",
  line: "#d8d5cc",
  accent: "#c1440e",
  bg: "#ffffff",
};

export const pdfStyles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: colors.ink,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1.5,
    borderBottomColor: colors.ink,
    paddingBottom: 10,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 8,
    letterSpacing: 1.5,
    color: colors.accent,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  headerRight: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  section: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 8,
    letterSpacing: 1.2,
    color: colors.muted,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  grid2: {
    flexDirection: "row",
    gap: 16,
  },
  grid3: {
    flexDirection: "row",
    gap: 16,
  },
  col: {
    flex: 1,
  },
  value: {
    fontSize: 10,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: colors.line,
    paddingVertical: 5,
  },
  rowHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.ink,
    paddingBottom: 4,
    marginBottom: 2,
  },
  th: {
    fontSize: 7,
    letterSpacing: 0.8,
    color: colors.muted,
    textTransform: "uppercase",
  },
  td: {
    fontSize: 9,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    fontSize: 7,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: colors.line,
    paddingTop: 6,
  },
});
