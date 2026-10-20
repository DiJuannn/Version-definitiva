// Registro de choques por fotograma para escenas Three.js («things may touch, never sink in»).
// En el Claw Machine el primer registro dio 76 pares que se atravesaban; se corrigió hasta que salió vacío en los 1200 fotogramas.
//
// Se carga en la página después de three.js y de la escena:
//   <script src="assets/choques-3d.js"></script>
//   window.registrarSolidos({ heroe: AX.root, mesa: panels.guion.g, claqueta: clap, avion: planeG, … });
// y se lanza desde Node/Playwright (o la consola):
//   const r = await page.evaluate(() => window.buscarChoques({ desde: 0, hasta: 12, fps: 30, margen: 0.01,
//                                                              permitidos: [["heroe", "mesa"]] }));
//
// Para cada fotograma llama a window.renderAt(t) (o render(t)), calcula la caja de cada sólido en el mundo
// (una caja por malla, Box3.setFromObject con precisión de vértices) y apunta los pares que se hunden más de `margen` metros en los tres ejes.
// Es una prueba de cajas: sirve para encontrar atravesamientos gordos (brazos dentro del mando, pies dentro del taburete,
// el personaje dentro del cristal). Para formas redondas, divide el sólido en partes (cabeza, cuerpo, cola…).
// Los apoyos normales (el héroe de pie sobre la mesa) van en `permitidos` o con un margen mayor.
(function () {
  const S = {};
  window.registrarSolidos = (m) => Object.assign(S, m);
  window.buscarChoques = ({ desde = 0, hasta, fps = 30, margen = 0.01, permitidos = [], paso = 1 } = {}) => {
    const ok = new Set(permitidos.map(([a, b]) => [a, b].sort().join("|")));
    const draw = window.renderAt || window.render;
    const nombres = Object.keys(S), cajas = {}, log = [], resumen = {};
    // cajas por malla (no por grupo): se ignoran sprites, líneas, puntos, contornos BackSide, materiales sin profundidad
    // y lo marcado con userData.noChoque
    const solida = (o) => o.isMesh && !o.isSprite && o.visible !== false && !o.userData.noChoque &&
      !(o.material && (o.material.side === THREE.BackSide || o.material.depthWrite === false));
    const visibleEnMundo = (o) => { for (let q = o; q; q = q.parent) if (q.visible === false) return false; return true; };
    const cajasDe = (raiz) => { const r = []; raiz.updateWorldMatrix(true, true);
      raiz.traverse((o) => { if (solida(o) && visibleEnMundo(o)) { const b = new THREE.Box3().setFromObject(o, true); if (!b.isEmpty()) r.push(b); } }); return r; };
    const hund = (A, C) => Math.min(Math.min(A.max.x, C.max.x) - Math.max(A.min.x, C.min.x),
      Math.min(A.max.y, C.max.y) - Math.max(A.min.y, C.min.y), Math.min(A.max.z, C.max.z) - Math.max(A.min.z, C.min.z));
    for (let f = Math.round(desde * fps); f < Math.round(hasta * fps); f += paso) {
      const t = f / fps; draw(t);
      for (const n of nombres) { const L = cajasDe(S[n]); const u = new THREE.Box3(); L.forEach((b) => u.union(b)); cajas[n] = { L, u }; }
      for (let i = 0; i < nombres.length; i++) for (let j = i + 1; j < nombres.length; j++) {
        const a = nombres[i], b = nombres[j], A = cajas[a], C = cajas[b];
        if (!A.L.length || !C.L.length || ok.has([a, b].sort().join("|")) || hund(A.u, C.u) <= margen) continue;
        let hundido = 0;
        for (const x of A.L) if (hund(x, C.u) > margen) for (const y of C.L) hundido = Math.max(hundido, hund(x, y));
        if (hundido > margen) {
          const k = `${a} × ${b}`; log.push({ f, t: +t.toFixed(3), par: k, hundido: +hundido.toFixed(3) });
          const r = (resumen[k] = resumen[k] || { primero: t, ultimo: t, fotogramas: 0, max: 0 });
          r.ultimo = t; r.fotogramas++; r.max = Math.max(r.max, hundido);
        }
      }
    }
    return { pares: Object.keys(resumen).length, resumen, log: log.slice(0, 500) };
  };
})();
