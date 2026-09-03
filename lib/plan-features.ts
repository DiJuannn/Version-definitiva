import {
  FREE_ACTIVE_PROJECTS_LIMIT,
  FREE_PROJECT_COLLABORATORS_LIMIT,
  SCRIPT_ANALYSIS_FREE_DAILY_LIMIT,
  SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT,
  SCRIPT_ANALYSIS_PRO_DAILY_LIMIT,
  SCRIPT_PAGE_LIMIT_FREE,
  SCRIPT_PAGE_LIMIT_PRO,
} from "@/lib/limits";

// Fuente única de qué incluye cada plan — usada por la comparación real
// en /app/organizacion y por la sección de precios de la web pública
// (/taller), para que nunca digan cosas distintas.
export const FREE_FEATURES = [
  `Hasta ${FREE_ACTIVE_PROJECTS_LIMIT} proyectos activos`,
  `Hasta ${FREE_PROJECT_COLLABORATORS_LIMIT} colaboradores por proyecto`,
  `Guiones de hasta ${SCRIPT_PAGE_LIMIT_FREE} páginas`,
  `${SCRIPT_ANALYSIS_FREE_DAILY_LIMIT} análisis de IA al día, ${SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT} en total`,
];

export const PRO_FEATURES = [
  "Proyectos y colaboradores ilimitados",
  `Guiones de hasta ${SCRIPT_PAGE_LIMIT_PRO} páginas`,
  `Hasta ${SCRIPT_ANALYSIS_PRO_DAILY_LIMIT} análisis de IA al día`,
  "Dossier completo del proyecto en PDF",
  "Detector de continuidad con IA",
  "Plantilla de documentos lista para firmar (permiso de rodaje, cesión de imagen, contrato de colaboración, autorización de menor, NDA)",
];
