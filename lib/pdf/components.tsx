import type { ReactNode } from "react";
import { Text, View } from "@react-pdf/renderer";
import { pdfStyles } from "@/lib/pdf/styles";

// Compartido por los 4 PDFs de informe (Dossier, Call sheet, Shot list,
// Presupuesto) — antes cada documento repetía su propia cabecera/pie a
// mano; esto asegura que los cuatro se vean como parte de la misma
// familia visual sin mantener cuatro copias del mismo JSX.
export function PdfHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string;
  title: string;
  meta?: string;
}) {
  return (
    <>
      <View style={pdfStyles.brandBar} fixed />
      <View style={pdfStyles.header}>
        <View>
          <Text style={pdfStyles.eyebrow}>{eyebrow}</Text>
          <Text style={pdfStyles.title}>{title}</Text>
        </View>
        {meta && <Text style={pdfStyles.headerRight}>{meta}</Text>}
      </View>
    </>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <View style={pdfStyles.sectionTitleWrap}>
      <Text style={pdfStyles.sectionTitle}>{children}</Text>
      <View style={pdfStyles.sectionRule} />
    </View>
  );
}

export function PdfFooter({ projectName }: { projectName?: string }) {
  return (
    <View style={pdfStyles.footer} fixed>
      <Text>Versión definitiva — Taller{projectName ? ` · ${projectName}` : ""}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

// Índice de fila dentro de su tabla (no de la página) → cebreado
// consistente aunque la tabla se corte entre páginas.
export function rowStyle(index: number) {
  return index % 2 === 1 ? [pdfStyles.row, pdfStyles.rowAlt] : pdfStyles.row;
}
