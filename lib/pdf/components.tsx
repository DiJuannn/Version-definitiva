import type { ReactNode } from "react";
import { Text, View } from "@react-pdf/renderer";
import { colors, pdfStyles } from "@/lib/pdf/styles";

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

const WATERMARK_TEXT = "VERSIÓN DEFINITIVA · TALLER";

// Cuadrícula de repeticiones diagonales muy tenues — se ve claramente que
// es una marca de agua (no se puede recortar solo una esquina), pero con
// opacidad tan baja que no molesta para leer el documento encima. Solo se
// usa en los PDFs que sí puede generar el plan Free (Call sheet, Shot
// list, Presupuesto) — el Dossier y las plantillas legales ya son
// exclusivas de PRO, así que nunca las genera nadie en Free.
export function Watermark() {
  const positions = [
    { top: 70, left: -60 },
    { top: 70, left: 210 },
    { top: 70, left: 480 },
    { top: 280, left: 60 },
    { top: 280, left: 330 },
    { top: 280, left: 600 },
    { top: 490, left: -60 },
    { top: 490, left: 210 },
    { top: 490, left: 480 },
    { top: 700, left: 60 },
    { top: 700, left: 330 },
    { top: 700, left: 600 },
  ];

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} fixed>
      {positions.map((pos, i) => (
        <Text
          key={i}
          style={{
            position: "absolute",
            top: pos.top,
            left: pos.left,
            fontSize: 13,
            fontFamily: "Helvetica-Bold",
            color: colors.ink,
            opacity: 0.07,
            letterSpacing: 1,
            transform: "rotate(-30deg)",
          }}
        >
          {WATERMARK_TEXT}
        </Text>
      ))}
    </View>
  );
}
