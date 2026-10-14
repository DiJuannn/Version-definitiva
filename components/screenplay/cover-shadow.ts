// Sombra de las portadas de guion sobre la mesa oscura de Taller: un filo de
// luz arriba y una sombra honda y corta debajo, como un taco de folios
// apoyado en la mesa. Sustituye a la de .sp-cover-sheet (globals.css), que
// estaba pensada para negro puro. Solo la usan la mesa de guiones y su
// portada en blanco. (Archivo sin "use client" para poder importarlo desde
// la página de servidor.)
export const COVER_SHADOW =
  "shadow-[0_1px_0_rgb(255_255_255/0.5)_inset,0_1px_2px_rgb(0_0_0/0.4),0_10px_18px_-8px_rgb(0_0_0/0.55),0_32px_56px_-24px_rgb(0_0_0/0.95)]! group-hover:shadow-[0_0_0_2px_var(--accent),0_14px_24px_-10px_rgb(0_0_0/0.6),0_40px_64px_-24px_rgb(0_0_0/1)]!";
