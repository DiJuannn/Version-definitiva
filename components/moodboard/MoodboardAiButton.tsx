"use client";

// Acción principal del moodboard, en la cabecera de la página (servidor). El
// panel de IA vive dentro del editor, que escucha este aviso y lo abre: así
// la cabecera no necesita cargar el editor para tener su botón.
export const MOODBOARD_AI_EVENT = "moodboard:open-ai";

export function MoodboardAiButton() {
  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() => window.dispatchEvent(new Event(MOODBOARD_AI_EVENT))}
    >
      <span aria-hidden>✦</span> Referencias con IA
    </button>
  );
}
