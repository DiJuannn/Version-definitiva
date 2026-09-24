// Nombre del archivo de vídeo de la cámara (Sony "C0009", Blackmagic
// "A001_C012", Canon "MVI_0034"…): la siguiente toma es el mismo nombre con
// el ÚLTIMO grupo de cifras sumado en uno, respetando los ceros a la
// izquierda — "C0009" → "C0010", "A001_C012" → "A001_C013". Sin cifras no
// hay forma segura de adivinarlo y se deja igual. Puro: lo usan la web y
// (copiado) la app.
export function nextClip(clip: string): string {
  // La extensión (".MP4", ".mxf") no cuenta: su "4" no es el número de toma.
  const ext = clip.match(/\.[A-Za-z][A-Za-z0-9]{1,4}$/)?.[0] ?? "";
  const base = clip.slice(0, clip.length - ext.length);
  const match = base.match(/^(.*?)(\d+)(\D*)$/);
  if (!match) return clip;
  const [, prefix, digits, suffix] = match;
  const next = String(Number(digits) + 1).padStart(digits.length, "0");
  return `${prefix}${next}${suffix}${ext}`;
}

// Clave de "última toma" por escena y plano: la toma vuelve a 1 al cambiar
// cualquiera de los dos (una escena nueva, o un plano nuevo de la misma
// escena, empiezan en la toma 1).
export function takeKey(sceneNumber: string, shotNumber: string | null | undefined): string {
  return `${sceneNumber.trim().toLowerCase()}|${(shotNumber ?? "").trim().toLowerCase()}`;
}
