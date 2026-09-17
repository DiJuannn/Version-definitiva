export function creditsToText(credits: unknown): string {
  if (!Array.isArray(credits)) return "";
  return credits
    .filter((c): c is { role: string; value: string } => !!c && typeof c === "object")
    .map((c) => `${c.role}: ${c.value}`)
    .join("\n");
}
