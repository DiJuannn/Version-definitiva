// Análisis de guion con IA: cuánto puede subir y lanzar cada cuenta.
// Todo es por cuenta (por usuario), no por proyecto — se cuenta en
// cualquier proyecto de la organización, porque cada análisis es una
// llamada real y con coste a Mistral.

// Tope por hora, igual para gratis y PRO — protege la cuota compartida
// de tokens/minuto de Mistral (ver admin.mistral.ai/plateforme/limits)
// de que una sola cuenta la agote lanzando análisis en bucle. No se
// anuncia en ningún sitio — solo aparece como aviso si se llega a él,
// con el tiempo exacto que falta para poder volver a intentarlo.
export const SCRIPT_ANALYSIS_HOURLY_LIMIT = 3;

// Plan gratuito: un análisis al día, y como mucho 3 en toda la vida de
// la cuenta — es una prueba del producto, no una herramienta de uso
// habitual; para más, hay que pasarse a PRO.
export const SCRIPT_ANALYSIS_FREE_DAILY_LIMIT = 1;
export const SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT = 3;

// Plan PRO: sin tope de por vida, pero sí uno diario generoso — evita
// que una sola cuenta (comprometida o mal usada) dispare el gasto sin
// límite.
export const SCRIPT_ANALYSIS_PRO_DAILY_LIMIT = 50;

// Páginas máximas de un guion según el plan de la organización que lo
// sube — pensado para no acercarse a la ventana de contexto del modelo
// de IA (ver lib/mistral.ts).
export const SCRIPT_PAGE_LIMIT_FREE = 80;
export const SCRIPT_PAGE_LIMIT_PRO = 200;
