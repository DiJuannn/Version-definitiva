// Estas rutas ya están protegidas por el token de Supabase Auth (ver
// lib/mobile-auth.ts), no por cookies — así que un origen distinto no
// puede "aprovecharse" de la sesión de nadie con una petición cruzada
// (no hay credenciales automáticas que el navegador adjunte solas, como
// sí pasa con cookies). Por eso permitir cualquier origen aquí es
// seguro: sirve para que la app funcione también en la vista web de
// Expo (útil para previsualizar sin un teléfono) y para cualquier
// futuro cliente nativo, sin abrir ningún agujero de autenticación.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};
