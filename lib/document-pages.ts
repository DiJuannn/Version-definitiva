import { PDFDocument } from "pdf-lib";

// Bytes por página usados para aproximar un .doc/.docx — no tienen un
// número de páginas real hasta que se renderizan (depende del visor),
// así que esto es solo una estimación conservadora a partir del peso
// del archivo, pensada para cortar casos claramente desproporcionados,
// no para ser exacta como sí lo es el conteo real de un PDF.
const DOCX_BYTES_PER_PAGE = 3000;

// Devuelve null si no se puede determinar (formato no reconocido o PDF
// corrupto) — en ese caso, quien llame a esta función decide si dejar
// pasar el archivo o no.
export async function countDocumentPages(file: File): Promise<number | null> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      return doc.getPageCount();
    } catch {
      return null;
    }
  }

  if (name.endsWith(".doc") || name.endsWith(".docx")) {
    return Math.max(1, Math.round(file.size / DOCX_BYTES_PER_PAGE));
  }

  return null;
}
