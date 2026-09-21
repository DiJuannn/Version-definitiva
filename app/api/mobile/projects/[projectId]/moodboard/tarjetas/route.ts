import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { applyMoodboardOpsCore, getMoodboard } from "@/lib/moodboard-core";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { NOTE_COLORS, type MoodboardCard } from "@/lib/moodboard-types";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

type NewCard =
  | { type: "palette"; title?: string; colors?: string[] }
  | { type: "reference"; title?: string; year?: string; kind?: string; why?: string }
  | { type: "note"; text?: string };

const SIZES = { palette: { w: 300, h: 150 }, reference: { w: 270, h: 210 }, note: { w: 250, h: 150 } } as const;

// POST /api/mobile/projects/:projectId/moodboard/tarjetas { cards: NewCard[] } — añade tarjetas (paleta, referencias y
// notas, por ejemplo las que se eligen de una propuesta de la IA). El servidor les pone id y sitio: a la derecha de
// todo lo que ya hay, en filas de 3. Lo demás del tablero no se toca (mismo guardado por cambios que la web).
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const body = (await request.json().catch(() => null)) as { cards?: unknown } | null;
  const incoming = (Array.isArray(body?.cards) ? body.cards : []).slice(0, 20) as NewCard[];
  const valid = incoming.filter((c) => c && (c.type === "palette" || c.type === "reference" || c.type === "note"));
  if (valid.length === 0) return NextResponse.json({ error: "No hay tarjetas que añadir." }, { status: 400, headers: CORS_HEADERS });

  const pro = await isProjectOwnerPro(project.organizationId);
  const existing = (await getMoodboard(projectId, pro)).cards;
  const cols = 3;
  const startX = existing.length ? Math.max(...existing.map((c) => c.x + c.w)) + 80 : 0;
  const startY = existing.length ? Math.min(...existing.map((c) => c.y)) : 0;

  let noteIndex = 0;
  const cards: MoodboardCard[] = valid.map((c, i) => {
    const size = SIZES[c.type];
    const base = {
      id: randomUUID().replace(/-/g, "").slice(0, 16),
      x: Math.round(startX + (i % cols) * 300),
      y: Math.round(startY + Math.floor(i / cols) * 240),
      ...size,
    };
    if (c.type === "palette") return { ...base, type: "palette", title: c.title, colors: c.colors };
    if (c.type === "reference") return { ...base, type: "reference", title: c.title, year: c.year, kind: c.kind, why: c.why };
    return { ...base, type: "note", text: c.text, color: NOTE_COLORS[noteIndex++ % NOTE_COLORS.length] };
  });

  const result = await applyMoodboardOpsCore(projectId, { upsert: cards }, pro);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400, headers: CORS_HEADERS });
  return NextResponse.json({ added: cards.length, updatedAt: result.updatedAt }, { headers: CORS_HEADERS });
}
