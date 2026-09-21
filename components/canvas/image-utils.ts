// Utilidades de imagen para las pizarras (Moodboard y Mapa del proyecto).

// Las fotos del móvil pesan varios MB: se reducen antes de subirlas (más rápido y
// dentro del límite de subida). Las pequeñas se suben tal cual.
export async function prepareImage(file: File): Promise<{ file: File; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  if (file.size <= 900_000) {
    bitmap.close();
    return { file, width, height };
  }
  for (const [maxSide, quality] of [
    [1800, 0.85],
    [1600, 0.75],
    [1280, 0.7],
    [1000, 0.65],
  ] as const) {
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= 900_000) {
      bitmap.close();
      const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      return { file: new File([blob], name, { type: "image/jpeg" }), width: canvas.width, height: canvas.height };
    }
  }
  bitmap.close();
  throw new Error("too-big");
}

export function loadImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("load"));
    img.src = url;
  });
}
