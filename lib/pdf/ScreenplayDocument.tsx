import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { ScreenplayBlock } from "@/lib/screenplay/blocks";
import {
  CHAR_WIDTH,
  LINE_HEIGHT,
  MARGIN,
  PAGE_SIZES,
  layoutScreenplay,
  type PageSize,
} from "@/lib/screenplay/layout";

// Guion con el formato estándar de la industria. Todas las posiciones salen
// de layoutScreenplay (Courier 12: 0,1" por carácter, 1/6" por línea), así
// que el PDF tiene exactamente las páginas que cuenta el editor.

const PT = 72; // puntos por pulgada
const FONT_SIZE = 12;

const lineStyle = {
  position: "absolute" as const,
  fontFamily: "Courier",
  fontSize: FONT_SIZE,
  lineHeight: 1,
};

export function ScreenplayDocument({
  title,
  author,
  blocks,
  size = "A4",
  draftDate,
}: {
  title: string;
  author: string | null;
  blocks: ScreenplayBlock[];
  size?: PageSize;
  draftDate?: string;
}) {
  const { width, height } = PAGE_SIZES[size];
  const pages = layoutScreenplay(blocks, { size, sceneNumbers: true });
  const pageSize = { width: width * PT, height: height * PT };
  const top = (row: number) => (MARGIN.top + row * LINE_HEIGHT) * PT;

  return (
    <Document title={title} author={author ?? undefined} creator="Taller — Versión definitiva">
      {/* Portada */}
      <Page size={pageSize}>
        <View style={{ position: "absolute", top: height * 0.36 * PT, left: 0, right: 0 }}>
          <Text style={{ fontFamily: "Courier-Bold", fontSize: FONT_SIZE, textAlign: "center", textDecoration: "underline" }}>
            {title.toUpperCase()}
          </Text>
          {author && (
            <>
              <Text style={{ fontFamily: "Courier", fontSize: FONT_SIZE, textAlign: "center", marginTop: FONT_SIZE * 3 }}>
                escrito por
              </Text>
              <Text style={{ fontFamily: "Courier", fontSize: FONT_SIZE, textAlign: "center", marginTop: FONT_SIZE }}>
                {author}
              </Text>
            </>
          )}
        </View>
        {draftDate && (
          <Text style={{ ...lineStyle, left: MARGIN.left * PT, bottom: MARGIN.bottom * PT }}>{draftDate}</Text>
        )}
      </Page>

      {pages.map((page) => (
        <Page key={page.number} size={pageSize}>
          {page.number > 1 && (
            <Text
              style={{
                ...lineStyle,
                top: (MARGIN.top / 2) * PT,
                left: (width - MARGIN.right) * PT - `${page.number}.`.length * CHAR_WIDTH * PT,
              }}
            >
              {page.number}.
            </Text>
          )}
          {page.lines.map((line, i) => {
            if (line.kind === "blank") return null;
            const bold = line.kind === "sceneHeading";
            return (
              <View key={i}>
                {line.sceneNumber && (
                  <>
                    <Text
                      style={{
                        ...lineStyle,
                        fontFamily: "Courier-Bold",
                        top: top(i),
                        left: (MARGIN.left - 0.75) * PT,
                      }}
                    >
                      {line.sceneNumber}
                    </Text>
                    <Text
                      style={{
                        ...lineStyle,
                        fontFamily: "Courier-Bold",
                        top: top(i),
                        left: (width - MARGIN.right + 0.4) * PT,
                      }}
                    >
                      {line.sceneNumber}
                    </Text>
                  </>
                )}
                <Text
                  style={{
                    ...lineStyle,
                    fontFamily: bold ? "Courier-Bold" : "Courier",
                    top: top(i),
                    left: line.x * PT,
                  }}
                >
                  {line.text}
                </Text>
              </View>
            );
          })}
        </Page>
      ))}
    </Document>
  );
}
