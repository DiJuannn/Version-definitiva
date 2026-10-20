// Ajolote de Taller en 3D (juguete de vinilo). window.Ajolote3D(THREE) → { root, pose(p) }
// Proporciones del 2D: cabeza ancha (≈ 60 % de la altura), cuerpo pequeño sentado, brazos colgando, pies,
// cola hacia la derecha, branquias en pluma naranjas (3 por lado). root: origen = suelo entre los pies, mira a +z.
window.Ajolote3D = function (THREE) {
  THREE.ColorManagement.legacyMode = false;          // los hex se leen como sRGB (si no, todo sale lavado)
  const C = window.CUES.palette;
  const std = (hex, r = 0.55, extra = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: r, metalness: 0, ...extra });
  const M = {
    pink: std("#f2a9bb", 0.5), belly: std("#fbd6df", 0.6), deep: std("#e48aa2", 0.55),
    gill: std("#ff7a45", 0.55), gillD: std("#f0502a", 0.55), eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(C.eye) }), white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    cheek: new THREE.MeshBasicMaterial({ color: new THREE.Color(C.cheek), transparent: true, opacity: 0.75, depthWrite: false }),
    mouth: std("#7a2a3a", 0.5), line: new THREE.MeshBasicMaterial({ color: new THREE.Color("#b8576f") }),
    outline: new THREE.MeshBasicMaterial({ color: new THREE.Color("#a8506a"), side: THREE.BackSide }),
  };
  const S = (r, w = 48, h = 32) => new THREE.SphereGeometry(r, w, h);
  const mesh = (g, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, outline = 0) => {
    const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; o.receiveShadow = true;
    if (outline) { const h = new THREE.Mesh(g, M.outline); h.scale.setScalar(1 + outline); o.add(h); }
    return o;
  };
  const root = new THREE.Group(); root.name = "ajolote";
  const squash = new THREE.Group(); root.add(squash);           // squash & stretch desde el suelo
  const bodyG = new THREE.Group(); squash.add(bodyG);

  // cuerpo sentado + barriga
  bodyG.add(mesh(S(0.2), M.pink, 0, 0.19, -0.02, 1.0, 1.0, 0.95, 0.03));
  bodyG.add(mesh(S(0.15), M.belly, 0, 0.17, 0.08, 0.95, 1.0, 0.7));
  for (let i = 0; i < 3; i++) {                                    // pliegues de la barriga
    const tor = new THREE.Mesh(new THREE.TorusGeometry(0.06 - i * 0.004, 0.004, 6, 24, Math.PI * 0.8), M.line);
    tor.position.set(0, 0.2 - i * 0.04, 0.19); tor.rotation.z = Math.PI * 1.1; bodyG.add(tor);
  }
  // pies (2) y brazos (2, con pivote en el hombro para saludar)
  const feet = [];
  for (const sx of [-1, 1]) { const f = mesh(S(0.075), M.pink, sx * 0.11, 0.035, 0.07, 1.2, 0.55, 1.35, 0.05); bodyG.add(f); feet.push(f); }
  const arms = [];
  for (const sx of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.set(sx * 0.17, 0.3, 0.06); bodyG.add(pv);
    const a = mesh(new THREE.CapsuleGeometry(0.048, 0.11, 8, 16), M.pink, 0, -0.08, 0, 1, 1, 1, 0.05); pv.add(a);
    pv.rotation.z = sx * 0.12; arms.push(pv);
  }
  // cola: curva suave hacia la derecha y arriba (muchas esferas solapadas = tubo con grosor decreciente)
  const tail = new THREE.Group(); tail.position.set(0.1, 0.1, -0.1); bodyG.add(tail);
  const tailCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.16, 0.0, -0.08), new THREE.Vector3(0.3, 0.06, -0.1), new THREE.Vector3(0.38, 0.2, -0.06), new THREE.Vector3(0.37, 0.33, 0.0)]);
  const tailSegs = [];
  for (let i = 0; i < 44; i++) {
    const u = i / 43, pt = tailCurve.getPoint(u), r = 0.085 * (1 - u * 0.78);
    const seg = mesh(S(r, 20, 14), M.pink, pt.x, pt.y, pt.z, 1, 1, 0.75); tail.add(seg);
    if (i > 3) tail.add(mesh(S(r * 0.9, 16, 10), M.deep, pt.x - r * 0.25, pt.y + r * 0.55, pt.z, 1.1, 0.55, 0.3));
  }
  tailSegs.push(tail);
  // cabeza
  const head = new THREE.Group(); head.position.set(0, 0.47, 0.02); bodyG.add(head);
  head.add(mesh(S(0.3, 64, 48), M.pink, 0, 0, 0, 1.38, 0.86, 0.95, 0.022));
  head.add(mesh(S(0.26, 48, 32), std("#eda3b6", 0.55), 0, -0.1, 0.0, 1.32, 0.4, 0.86));    // papada (tono más hondo debajo)
  
  // ojos (abiertos) + ojos felices ^^
  const eyes = [], happy = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(sx * 0.15, 0.02, 0.265); head.add(e);
    e.add(mesh(S(0.038, 24, 16), M.eye, 0, 0, 0, 0.85, 1, 0.6));
    e.add(mesh(S(0.012, 12, 8), M.white, sx * -0.008, 0.014, 0.02));
    eyes.push(e);
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.008, 8, 24, Math.PI), M.eye);
    h.position.set(sx * 0.15, 0.0, 0.275); h.visible = false; head.add(h); happy.push(h);
  }
  // cejitas
  for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 16, Math.PI * 0.6), M.line); b.position.set(sx * 0.15, 0.085, 0.27); b.rotation.z = Math.PI * 0.2 + (sx < 0 ? 0.1 : -0.1); head.add(b); }
  // mofletes
  for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.05, 24), M.cheek); c.position.set(sx * 0.27, -0.06, 0.205); c.rotation.y = sx * 0.62; c.scale.set(1.25, 0.8, 1); head.add(c); }
  // boca: sonrisa cerrada / abierta
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 8, 24, Math.PI), M.mouth); smile.position.set(0, -0.05, 0.283); smile.rotation.z = Math.PI; head.add(smile);
  const open = mesh(S(0.034, 24, 16), M.mouth, 0, -0.062, 0.272, 1.1, 0.9, 0.5); open.visible = false; head.add(open);
  // branquias: 3 por lado, tallo hacia fuera + foliolos aplanados en pluma (como el 2D)
  const gills = [];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group(); g.position.set(sx * 0.385, 0.1 - i * 0.095, -0.04); head.add(g);
      const base = sx * (0.5 - i * 0.5);           // abanico: arriba, horizontal, abajo
      g.rotation.z = base; g.rotation.y = sx * -0.2;
      const L = i === 1 ? 0.26 : 0.22;
      const stem = mesh(new THREE.CapsuleGeometry(0.016, L, 6, 12), M.gill, sx * L * 0.5, 0, 0); stem.rotation.z = Math.PI / 2; g.add(stem);
      for (let k = 0; k < 6; k++) {
        const u = 0.22 + k * 0.14, len = 0.07 - k * 0.006;
        for (const side of [-1, 1]) {
          const lf = mesh(S(1, 12, 8), k % 2 ? M.gillD : M.gill, sx * (L * u + 0.012), side * (len * 0.45), 0, len * 0.55, 0.014, 0.016);
          lf.rotation.z = side * sx * 0.9; g.add(lf);
        }
      }
      gills.push({ g, sx, i, base });
    }
  }

  // tarjeta plana (fase pegatina): plano con el ajolote 2D
  const tex = new THREE.TextureLoader().load("assets/ajolote-2d.png"); tex.encoding = THREE.sRGBEncoding;
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.84, 24, 24), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  card.geometry.translate(0, 0.42, 0); card.visible = false; root.add(card);

  // pose(p): squash (−1 estirado … +1 aplastado), blink, happy, mouth (0/1), gill (fase), armL/armR (rad), tail (fase), look (rad), card (true → solo tarjeta)
  function pose(p = {}) {
    const sq = p.squash || 0;
    squash.scale.set(1 + sq * 0.18, 1 - sq * 0.22, 1 + sq * 0.18);
    const b = p.blink || 0;
    eyes.forEach((e) => (e.scale.y = Math.max(0.08, 1 - b)));
    const hp = (p.happy || 0) > 0.5;
    eyes.forEach((e) => (e.visible = !hp)); happy.forEach((h) => (h.visible = hp));
    smile.visible = !(p.mouth > 0.5); open.visible = p.mouth > 0.5;
    const gp = p.gill || 0, ga = p.gillAmp == null ? 0.12 : p.gillAmp;
    gills.forEach(({ g, sx, i, base }) => (g.rotation.z = base + sx * Math.sin(gp + i * 0.9) * ga + sx * (p.gillLift || 0)));
    arms[0].rotation.z = -0.12 - (p.armL || 0); arms[1].rotation.z = 0.12 + (p.armR || 0);
    const tp = p.tail || 0; tail.rotation.y = Math.sin(tp) * 0.18; tail.rotation.z = Math.sin(tp * 0.7) * 0.06;
    head.rotation.y = p.look || 0; head.rotation.z = p.tilt || 0; head.rotation.x = p.nod || 0;
    squash.visible = !p.card; card.visible = !!p.card;
    if (p.card) {                                     // curvatura de la pegatina al despegarse (0 → plana, 1 → doblada)
      const pos = card.geometry.attributes.position, k = p.curl || 0;
      if (!card.userData.base) card.userData.base = Float32Array.from(pos.array);
      const B = card.userData.base;
      for (let i = 0; i < pos.count; i++) { const y = B[i * 3 + 1]; pos.array[i * 3 + 2] = B[i * 3 + 2] + Math.pow(Math.max(0, 0.84 - y) / 0.84, 2) * -0.35 * k; }
      pos.needsUpdate = true;
    }
  }
  pose({});
  return { root, pose, card };
};
