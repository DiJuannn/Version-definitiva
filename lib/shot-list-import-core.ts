import { prisma } from "@/lib/prisma";
import { analyzeShotListPdf, type ShotListProposal } from "@/lib/mistral";
import type { OrganizationPlan } from "@/lib/generated/prisma";
import {
  SCRIPT_PAGE_LIMIT_FREE,
  SCRIPT_PAGE_LIMIT_PRO,
  SHOT_LIST_IMPORT_FREE_DAILY_LIMIT,
  SHOT_LIST_IMPORT_FREE_LIFETIME_LIMIT,
  SHOT_LIST_IMPORT_HOURLY_LIMIT,
  SHOT_LIST_IMPORT_PRO_DAILY_LIMIT,
} from "@/lib/limits";
import { checkShotListImportRateLimit, formatWait } from "@/lib/shot-list-import-rate-limit";
import { MistralBusyError, withMistralSlot } from "@/lib/mistral-concurrency";
import { isPro } from "@/lib/plan";
import { countDocumentPages } from "@/lib/document-pages";
import { uploadProjectFile } from "@/lib/storage";
import * as Sentry from "@sentry/nextjs";

function cleanText(value: string | undefined | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Sube el guion técnico y lo analiza en el mismo paso (a diferencia del
// guion narrativo, aquí no hace falta guardar el archivo por separado
// para volver a analizarlo más tarde — es un flujo de un solo uso).
export async function analyzeShotListCore(
  projectId: string,
  organizationPlan: OrganizationPlan,
  userId: string,
  file: File,
): Promise<{ importId: string } | { error: string; upgrade?: boolean }> {
  const pro = isPro(organizationPlan);

  if (!pro) {
    const lifetimeCount = await prisma.shotListImport.count({ where: { createdById: userId } });
    if (lifetimeCount >= SHOT_LIST_IMPORT_FREE_LIFETIME_LIMIT) {
      return {
        error: `Has usado las ${SHOT_LIST_IMPORT_FREE_LIFETIME_LIMIT} importaciones disponibles en tu cuenta gratuita. Pásate a PRO en Organización para importar más guiones técnicos.`,
        upgrade: true,
      };
    }
  }

  const hourlyStatus = await checkShotListImportRateLimit(
    userId,
    SHOT_LIST_IMPORT_HOURLY_LIMIT,
    60 * 60 * 1000,
  );
  if (hourlyStatus.blocked && hourlyStatus.retryAt) {
    return {
      error: `Has lanzado ${SHOT_LIST_IMPORT_HOURLY_LIMIT} importaciones seguidas. Puedes volver a intentarlo en ${formatWait(hourlyStatus.retryAt)}.`,
    };
  }

  const dailyLimit = pro ? SHOT_LIST_IMPORT_PRO_DAILY_LIMIT : SHOT_LIST_IMPORT_FREE_DAILY_LIMIT;
  const dailyStatus = await checkShotListImportRateLimit(userId, dailyLimit, 24 * 60 * 60 * 1000);
  if (dailyStatus.blocked && dailyStatus.retryAt) {
    return {
      error: pro
        ? `Has alcanzado el máximo de ${dailyLimit} importaciones en 24 horas. Puedes volver a intentarlo en ${formatWait(dailyStatus.retryAt)}.`
        : `Ya has usado tu importación de hoy en el plan gratuito. Puedes volver a intentarlo en ${formatWait(dailyStatus.retryAt)}, o pásate a PRO en Organización para importar más.`,
      upgrade: !pro,
    };
  }

  const pageLimit = pro ? SCRIPT_PAGE_LIMIT_PRO : SCRIPT_PAGE_LIMIT_FREE;
  const pageCount = await countDocumentPages(file);
  if (pageCount !== null && pageCount > pageLimit) {
    return {
      error: pro
        ? `Este documento tiene ${pageCount} páginas — el máximo por importación es ${pageLimit}.`
        : `Este documento tiene ${pageCount} páginas — el plan gratuito permite hasta ${pageLimit}. Pásate a PRO para documentos más largos.`,
      upgrade: !pro,
    };
  }

  const uploaded = await uploadProjectFile(projectId, file);
  if (!uploaded) {
    return { error: "No se pudo subir el archivo. Comprueba tu conexión e inténtalo de nuevo." };
  }

  let proposal: ShotListProposal;
  try {
    proposal = await withMistralSlot(() => analyzeShotListPdf(uploaded.url));
  } catch (error) {
    if (error instanceof MistralBusyError) {
      return {
        error: "Hay varios análisis en marcha ahora mismo. Inténtalo de nuevo en unos segundos.",
      };
    }
    console.error("analyzeShotListCore: fallo llamando a Mistral", error);
    Sentry.captureException(error, {
      tags: { area: "mistral", action: "analyzeShotList" },
      extra: { projectId },
    });
    return {
      error: "La IA no está disponible en este momento. Tus datos están seguros — inténtalo de nuevo en un rato.",
    };
  }

  const importRow = await prisma.shotListImport.create({
    data: {
      projectId,
      createdById: userId,
      fileUrl: uploaded.url,
      fileName: uploaded.name,
      proposedData: proposal,
    },
  });

  return { importId: importRow.id };
}

const MAX_SCENES = 300;
const MAX_SHOTS_PER_SCENE = 200;
const MAX_FIELD = 4000;
const MAX_SHORT = 160;

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function sanitizeShotListProposal(input: unknown): ShotListProposal {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const scenesRaw = Array.isArray(raw.scenes)
    ? (raw.scenes as unknown[])
        .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
        .slice(0, MAX_SCENES)
    : [];

  return {
    scenes: scenesRaw
      .map((scene) => {
        const shotsRaw = Array.isArray(scene.shots)
          ? (scene.shots as unknown[])
              .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
              .slice(0, MAX_SHOTS_PER_SCENE)
          : [];
        return {
          number: str(scene.number, 40),
          shots: shotsRaw
            .map((shot) => ({
              number: str(shot.number, 40),
              shotType: str(shot.shotType, MAX_SHORT) || undefined,
              shotSize: str(shot.shotSize, MAX_SHORT) || undefined,
              angle: str(shot.angle, MAX_SHORT) || undefined,
              movement: str(shot.movement, MAX_SHORT) || undefined,
              camera: str(shot.camera, MAX_SHORT) || undefined,
              lens: str(shot.lens, MAX_SHORT) || undefined,
              description: str(shot.description, MAX_FIELD) || undefined,
              audio: str(shot.audio, MAX_FIELD) || undefined,
              notes: str(shot.notes, MAX_FIELD) || undefined,
            }))
            .filter((s) => s.number),
        };
      })
      .filter((s) => s.number && s.shots.length > 0),
  };
}

// Importa la propuesta ya revisada: por cada escena, reutiliza la escena
// existente si el número coincide (igual criterio que el guion narrativo)
// o crea una mínima si no existe todavía. Por cada plano dentro de la
// escena, actualiza el plano existente con ese número o crea uno nuevo —
// así reimportar el mismo guion técnico (tras corregirlo) no duplica.
export async function importShotListCore(
  projectId: string,
  importId: string,
  reviewed: unknown,
): Promise<boolean> {
  const importRow = await prisma.shotListImport.findFirst({ where: { id: importId, projectId } });
  if (!importRow) return false;

  const proposal = sanitizeShotListProposal(reviewed);

  await prisma.$transaction(async (db) => {
    const existingScenes = await db.scene.findMany({
      where: { projectId },
      select: { id: true, number: true },
    });
    const sceneIdByNumber = new Map(existingScenes.map((s) => [s.number, s.id]));
    let sceneOrder = existingScenes.length;

    for (const scene of proposal.scenes) {
      let sceneId = sceneIdByNumber.get(scene.number);
      if (!sceneId) {
        const created = await db.scene.create({
          data: { projectId, number: scene.number, order: sceneOrder++ },
        });
        sceneId = created.id;
        sceneIdByNumber.set(scene.number, sceneId);
      }

      const existingShots = await db.shot.findMany({
        where: { sceneId },
        select: { id: true, number: true },
      });
      const shotIdByNumber = new Map(existingShots.map((s) => [s.number, s.id]));
      let shotOrder = existingShots.length;

      for (const shot of scene.shots) {
        const data = {
          shotType: cleanText(shot.shotType),
          shotSize: cleanText(shot.shotSize),
          angle: cleanText(shot.angle),
          movement: cleanText(shot.movement),
          camera: cleanText(shot.camera),
          lens: cleanText(shot.lens),
          description: cleanText(shot.description),
          audio: cleanText(shot.audio),
          notes: cleanText(shot.notes),
        };
        const existingShotId = shotIdByNumber.get(shot.number);
        if (existingShotId) {
          await db.shot.update({ where: { id: existingShotId }, data });
        } else {
          await db.shot.create({
            data: { sceneId, number: shot.number, order: shotOrder++, ...data },
          });
        }
      }
    }

    await db.shotListImport.update({
      where: { id: importId },
      data: { status: "REVIEWED", reviewedAt: new Date() },
    });
  });

  return true;
}
