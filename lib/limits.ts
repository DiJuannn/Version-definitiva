// Análisis de guion con IA: cuánto puede subir y lanzar cada cuenta.
// Todo es por cuenta (por usuario), no por proyecto — se cuenta en
// cualquier proyecto de la organización, porque cada análisis es una
// llamada real y con coste a Mistral.

// Tope por hora, igual para gratis y PRO — protege la cuota compartida
// de tokens/minuto de Mistral (ver admin.mistral.ai/plateforme/limits)
// de que una sola cuenta la agote lanzando análisis en bucle.
export const SCRIPT_ANALYSIS_HOURLY_LIMIT = 3;

// Tope adicional solo para el plan gratuito, por día — el aviso a
// pasarse a PRO. Las cuentas PRO no tienen tope diario, solo el de
// arriba.
export const SCRIPT_ANALYSIS_FREE_DAILY_LIMIT = 3;

// Páginas máximas de un guion según el plan de la organización que lo
// sube — pensado para no acercarse a la ventana de contexto del modelo
// de IA (ver lib/mistral.ts).
export const SCRIPT_PAGE_LIMIT_FREE = 80;
export const SCRIPT_PAGE_LIMIT_PRO = 200;
