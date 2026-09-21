"use server";

import { getProjectForCurrentUser } from "@/lib/project-access";
import { searchProjectContent } from "@/lib/project-search";
import type { SearchHit } from "@/lib/search-hits";

// Busca dentro del proyecto (escenas, personajes, sitios, tareas…). Solo lee.
export async function searchProject(projectId: string, query: string): Promise<SearchHit[]> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return [];
  return searchProjectContent(projectId, project.organizationId, query);
}
