// Sistema de movimiento de toda la web: una curva, tres duraciones y una
// forma de entrar. Todo lo que se anima tira de aquí, para que la web
// pública y el Taller se sientan de la misma marca (y no cada pantalla con
// sus propios números sueltos).
//
// Dos personalidades sobre la misma base:
// - Web pública: editorial/"premium" — algo más lenta y con más recorrido.
// - Taller (herramienta de trabajo): rápida y sobria, sin rebotes — la
//   animación nunca debe hacer esperar a quien está trabajando.

// Curva propia: arranca rápido y aterriza suave. Para entradas y para casi todo.
export const EASE = [0.16, 1, 0.3, 1] as const;
// Salidas: arranca suave y se va rápido (las salidas son más cortas que las entradas).
export const EASE_EXIT = [0.7, 0, 0.84, 0] as const;
// Lo que cambia sin entrar ni salir (un subrayado que se desliza, un panel que crece).
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

// En segundos (Motion) — en CSS, los mismos valores en ms.
export const DURATION = {
  // Respuesta a un toque o al pasar el ratón: tiene que sentirse inmediata.
  quick: 0.15,
  // Cambios de estado, avisos, pestañas, tarjetas.
  standard: 0.3,
  // Entradas grandes de la web pública.
  slow: 0.5,
} as const;

// Entrada única: subir unos píxeles mientras aparece.
export const ENTER = {
  public: { y: 16, duration: DURATION.slow },
  taller: { y: 8, duration: DURATION.standard },
} as const;

// Retraso entre elementos de una lista que entran uno tras otro. El total
// nunca debe pasar de ~0,4 s: más allá, la lista "hace esperar".
export const STAGGER = {
  public: 0.06,
  taller: 0.04,
} as const;
