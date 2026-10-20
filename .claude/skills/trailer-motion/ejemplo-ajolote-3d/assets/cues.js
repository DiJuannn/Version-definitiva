// Única fuente de verdad: tiempos (s) y posiciones (mundo, m). La leen la escena, los paneles y la banda sonora.
// 12,0 s · 30 fps · 120 BPM (beat 0,5 s) → cada aterrizaje cae en un beat.
window.CUES = {
  dur: 12.0, fps: 30, bpm: 120, beat: 0.5,
  // paneles: losas horizontales (y = altura de la cara superior), centro (x,z), tamaño (w,d), lienzo (px)
  panels: {
    guion: { x: -3.7, y: 0.0, z: 0.35, w: 2.5, d: 3.3, px: [1000, 1320], tilt: 0.0 },
    plan:  { x: 0.25, y: 0.35, z: -0.55, w: 3.9, d: 2.35, px: [1560, 940], tilt: 0.0 },
    hoja:  { x: 4.15, y: 0.7, z: 0.25, w: 3.3, d: 2.15, px: [1320, 860], tilt: 0.0 },
    claqueta: { x: 0.6, y: 1.25, z: 2.5, w: 1.7, d: 1.2 },
  },
  // golpes
  hits: {
    knock1: 0.75, knock2: 1.15, peel: 1.5, pop: 2.0,
    g1: 2.5, g2: 3.0, g3: 3.5,            // saltos sobre las 3 escenas del guion (desglose)
    leap1: 4.0, landPlan: 4.5,            // salto mortal al plan de rodaje
    d1: 5.0, d2: 5.5, d3: 6.0,            // las escenas caen en los días
    leap2: 6.5, landHoja: 7.0,
    c1: 7.5, c2: 8.0,                      // avisos (dos saltos, el segundo avisa a tres)
    fold: 8.5, ride: 9.0, rideEnd: 9.75,  // la hoja se dobla en avión, vuela
    accion: 10.0,                          // aterriza en la claqueta: ¡ACCIÓN!
    down: 10.45, logo: 11.0, wave: 11.25, end: 12.0,
  },
  // dónde está el ajolote en cada aterrizaje (coordenadas sobre la cara superior de cada losa)
  spots: {
    sticker: ["guion", -0.15, 0.85],
    g1: ["guion", -0.55, -0.85], g2: ["guion", 0.1, -0.05], g3: ["guion", -0.35, 0.75],
    landPlan: ["plan", -1.35, 0.35], d1: ["plan", -1.0, -0.15], d2: ["plan", 0.1, -0.15], d3: ["plan", 1.2, -0.15],
    landHoja: ["hoja", -1.15, 0.35], c1: ["hoja", -0.55, -0.15], c2: ["hoja", 0.65, -0.15],
    accion: ["claqueta", 0.15, 0.1],
  },
  palette: {
    bg: "#16110f", ink: "#121212", paper: "#ece8dc", yellow: "#f0c94a", coral: "#ff6a45", orange: "#ff8a5e",
    pink: "#f7c1cc", pinkLight: "#fde3e8", pinkDeep: "#eea3b5", cheek: "#ff8aa3", eye: "#1b1b20", green: "#5fd38d", cyan: "#7fd3e6",
  },
};
