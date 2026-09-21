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

// Cuántas llamadas a Mistral (análisis de guion o continuidad) pueden
// estar en marcha a la vez, en toda la cuenta — no por usuario. Con la
// cuota actual de tokens/minuto del workspace (ver
// admin.mistral.ai/plateforme/limits), un guion largo puede consumir
// casi toda la cuota de un minuto él solo, así que de momento el número
// seguro es muy bajo. Súbelo si la cuota de Mistral sube de forma
// notable (ver lib/mistral-concurrency.ts).
export const MISTRAL_MAX_CONCURRENT_CALLS = 2;

// Plan gratuito: cuántos proyectos puede tener la organización (creados
// por ella, no compartidos con ella) y cuántos colaboradores puede
// invitar a UN proyecto por enlace (ver lib/actions/project-shares.ts).
// Los proyectos y colaboradores que ya existan nunca se tocan al bajar
// de PRO a gratis — solo se bloquea crear uno más por encima del tope.
export const FREE_ACTIVE_PROJECTS_LIMIT = 2;
export const FREE_PROJECT_COLLABORATORS_LIMIT = 2;

// Moodboard (tablero libre del proyecto): el plan gratuito puede tener hasta
// este número de tarjetas; PRO no tiene tope práctico, salvo MOODBOARD_MAX_CARDS,
// que protege el rendimiento del tablero en el navegador. Las sugerencias de
// referencias con IA: el plan gratuito tiene UNA sugerencia por proyecto (en total)
// y PRO hasta MOODBOARD_AI_PRO_DAILY_LIMIT al día por proyecto.
export const MOODBOARD_FREE_CARD_LIMIT = 30;
export const MOODBOARD_MAX_CARDS = 300;
export const MOODBOARD_AI_FREE_PER_PROJECT = 1;
export const MOODBOARD_AI_PRO_DAILY_LIMIT = 10;

// Pizarra del Mapa del proyecto: las tarjetas de herramienta (una por herramienta)
// no cuentan; sí lo que pone la persona (notas, textos, imágenes, formas y
// secciones). Gratis hasta MAP_FREE_ITEM_LIMIT; PRO hasta MAP_MAX_ITEMS, que
// protege el rendimiento del navegador.
export const MAP_FREE_ITEM_LIMIT = 30;
export const MAP_MAX_ITEMS = 300;
